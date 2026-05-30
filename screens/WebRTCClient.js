// screens/WebRTCClient.js
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';

class WebRTCClient {
  constructor() {
    this.pc = null;
    this.onRemoteStream = null;
    this.onSignal = null;
  }

  async createPeerConnection() {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    this.pc.onaddstream = (event) => {
      if (this.onRemoteStream) {
        this.onRemoteStream(event.stream);
      }
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.onSignal) {
        this.onSignal('candidate:' + event.candidate.candidate);
      }
    };

    // Also handle ontrack for modern browsers (but onaddstream is fine for this lib)
  }

  async createOffer() {
    const offer = await this.pc.createOffer({ offerToReceiveAudio: true });
    await this.pc.setLocalDescription(offer);
    if (this.onSignal) {
      this.onSignal('offer:' + offer.sdp);
    }
  }

  async handleSignal(message) {
    if (!this.pc) return;
    if (message.startsWith('offer:')) {
      const sdp = message.substring(6);
      await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      if (this.onSignal) this.onSignal('answer:' + answer.sdp);
    } else if (message.startsWith('answer:')) {
      const sdp = message.substring(7);
      await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
    } else if (message.startsWith('candidate:')) {
      const candidate = message.substring(10);
      await this.pc.addIceCandidate(new RTCIceCandidate({ candidate, sdpMid: '0', sdpMLineIndex: 0 }));
    }
  }

  close() {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }
}

export default WebRTCClient;