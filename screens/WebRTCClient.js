// screens/WebRTCClient.js
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';
import AsyncStorage from '@react-native-async-storage/async-storage';

class WebRTCClient {
  constructor() {
    this.pc = null;
    this.remoteAudioStream = null;
  }

  async createPeerConnection() {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // When remote audio track arrives
    this.pc.onaddstream = (event) => {
      this.remoteAudioStream = event.stream;
      // The stream can be passed to a <RTCView> for playback (or we handle audio directly)
      if (this.onRemoteStream) {
        this.onRemoteStream(event.stream);
      }
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Send candidate to Omni via WebSocket
        this.sendSignal('candidate:' + event.candidate.candidate);
      }
    };
  }

  async createOffer() {
    const offer = await this.pc.createOffer({ offerToReceiveAudio: true });
    await this.pc.setLocalDescription(offer);
    this.sendSignal('offer:' + offer.sdp);
  }

  async handleSignal(message) {
    if (message.startsWith('offer:')) {
      const sdp = message.substring(6);
      await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      this.sendSignal('answer:' + answer.sdp);
    } else if (message.startsWith('answer:')) {
      const sdp = message.substring(7);
      await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
    } else if (message.startsWith('candidate:')) {
      const candidate = message.substring(10);
      await this.pc.addIceCandidate(new RTCIceCandidate({ candidate, sdpMid: '0', sdpMLineIndex: 0 }));
    }
  }

  // This will be set by the CallScreen to forward messages over the existing WebSocket
  sendSignal = (msg) => {
    if (this.onSignal) this.onSignal(msg);
  };

  close() {
    if (this.pc) this.pc.close();
    this.pc = null;
  }
}

export default WebRTCClient;