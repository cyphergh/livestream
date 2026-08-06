// Minimal WHEP client for low-latency viewing from MediaMTX via WebRTC.

export async function attachWhep(
  video: HTMLVideoElement,
  whepUrl: string,
  onState?: (state: string) => void
): Promise<{ close: () => void }> {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

  pc.addTransceiver('audio', { direction: 'recvonly' });
  pc.addTransceiver('video', { direction: 'recvonly' });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // Register the track handler BEFORE processing the answer so we never miss a
  // track event that fires while the remote description is being applied.
  // MediaMTX answers don't include a=msid, so ontrack fires once per track with
  // an empty `streams` array. Accumulate every track into ONE MediaStream; if we
  // reassigned srcObject per track, the last track (audio) would silently drop video.
  const outStream = new MediaStream();
  const addTrack = (t: MediaStreamTrack | null | undefined) => {
    if (t && !outStream.getTracks().includes(t)) outStream.addTrack(t);
  };
  pc.ontrack = (e) => {
    e.streams[0]?.getTracks().forEach(addTrack);
    addTrack(e.track);
    video.srcObject = outStream;
    video.play().catch(() => {});
  };

  const res = await fetch(whepUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/sdp' },
    body: pc.localDescription!.sdp,
  });
  if (!res.ok) throw new Error(`WHEP failed (${res.status})`);

  const answer = await res.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answer });
  const resource = res.headers.get('Location') ?? whepUrl;

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      fetch(resource, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/trickle-ice-sdpfrag' },
        body: JSON.stringify({
          candidate: e.candidate.candidate,
          sdpMid: e.candidate.sdpMid,
          sdpMLineIndex: e.candidate.sdpMLineIndex,
        }),
      }).catch(() => {});
    }
  };

  pc.onconnectionstatechange = () => {
    // 'disconnected' can be transient; only give up after a hard failure.
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      close();
    }
    onState?.(pc.connectionState);
  };

  const close = () => {
    pc.close();
    fetch(resource, { method: 'DELETE' }).catch(() => {});
  };
  return { close };
}
