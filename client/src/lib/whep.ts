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

  const res = await fetch(whepUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/sdp' },
    body: pc.localDescription!.sdp,
  });
  if (!res.ok) throw new Error(`WHEP failed (${res.status})`);

  const answer = await res.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answer });
  const resource = res.headers.get('Location') ?? whepUrl;

  pc.ontrack = (e) => {
    // Some browsers/answers don't associate a MediaStream with the track;
    // wrap the track so the video element always gets a srcObject.
    video.srcObject = e.streams[0] ?? new MediaStream([e.track]);
    video.play().catch(() => {});
  };

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

  pc.onconnectionstatechange = () => onState?.(pc.connectionState);

  const close = () => {
    pc.close();
    fetch(resource, { method: 'DELETE' }).catch(() => {});
  };
  return { close };
}
