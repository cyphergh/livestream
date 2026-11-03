// Minimal WHIP client (RFC 8614) for publishing WebRTC to our backend,
// which proxies to MediaMTX. Handles offer/answer + ICE + teardown.

export interface WhipSession {
  pc: RTCPeerConnection;
  resource: string;
  close: () => void;
}

export class WhipError extends Error {}

export async function startWhip(opts: {
  resourceUrl: string;
  stream: MediaStream;
  accessToken: string;
  onIceTrickle?: (candidate: RTCIceCandidate) => void;
}): Promise<WhipSession> {
  const { resourceUrl, stream, accessToken } = opts;

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });
  stream.getTracks().forEach((t) => pc.addTrack(t, stream));

  // Prefer H.264 for the video track. Browsers (Chrome/Android) default to VP8,
  // which MediaMTX's HLS muxer silently drops — leaving remote HLS viewers with
  // an audio-only stream and a blank screen. Fall back to the browser default
  // when no H.264 encoder is available.
  if (typeof RTCRtpSender !== 'undefined' && stream.getVideoTracks()[0]) {
    const h264 = (RTCRtpSender.getCapabilities?.('video')?.codecs ?? []).filter(
      (c) => c.mimeType.toLowerCase() === 'video/h264'
    );
    const videoTransceiver = pc.getTransceivers().find((t) => t.sender.track?.kind === 'video');
    if (videoTransceiver && h264.length > 0) videoTransceiver.setCodecPreferences(h264);
  }

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const resourceResponse = await request(
    resourceUrl,
    'POST',
    pc.localDescription!.sdp,
    'application/sdp',
    accessToken
  );

  // Resource URL per RFC 8614 (Location header) or fall back to the original.
  const resource = resourceResponse.headers.get('Location') ?? resourceUrl;

  const answerSdp = await resourceResponse.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    pc.close();
    fetch(resource, { method: 'DELETE' }).catch(() => {});
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      close();
    }
  };

  pc.onicecandidate = (e) => {
    if (e.candidate && !closed) {
      trickle(resource, e.candidate, accessToken).catch(() => {});
      opts.onIceTrickle?.(e.candidate);
    }
  };

  return { pc, resource, close };
}

async function trickle(
  resource: string,
  candidate: RTCIceCandidate,
  accessToken: string
): Promise<void> {
  const fragment = {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
  };
  await request(resource, 'PATCH', JSON.stringify(fragment), 'application/trickle-ice-sdpfrag', accessToken);
}

async function request(
  url: string,
  method: string,
  body: string,
  contentType: string,
  accessToken: string
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': contentType,
      Authorization: `Bearer ${accessToken}`,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new WhipError(`WHIP ${method} failed (${res.status}): ${text}`);
  }
  return res;
}
