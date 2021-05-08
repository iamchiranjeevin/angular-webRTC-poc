import { AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { Component, OnInit } from '@angular/core';
import { off } from 'process';
import { Message } from '../types/message';
import { DataService } from './service/data.service';

const mediaConstraints = {
  audio: true,
  video: { width: 720, height: 540 }
};

const offerOptions = {

  offerToReceiveAudio: true,
  offerToReceiveVideo: true,

};


@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit, AfterViewInit {

  private localStream: MediaStream;
  @ViewChild('local_video') localVideo: ElementRef;
  @ViewChild('received_video') remoteVideo: ElementRef;

  /* remote connection */
  private peerConnection: RTCPeerConnection;

  constructor(private dataService: DataService) { }

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
    this.addIncomingMessageHandler();
    this.requestMediaDevices();
  }

  private async requestMediaDevices(): Promise<void> {
    this.localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
    /* pause video on first load */
    this.pauseLocalVideo();
  }

  pauseLocalVideo() {
    this.localStream.getTracks().forEach(track => {
      track.enabled = false;
    });
    this.localVideo.nativeElement.srcObject = undefined;
  }

  startLocalVideo() {
    this.localStream.getTracks().forEach(track => {
      track.enabled = true;
    });
    this.localVideo.nativeElement.srcObject = this.localStream;;
  }

  async call(): Promise<void> {
    this.createPeerConnection();

    this.localStream.getTracks().forEach(track =>
      this.peerConnection.addTrack(track, this.localStream)
    );

    try {
      const offer: RTCSessionDescriptionInit = await this.peerConnection.createOffer(offerOptions);
      await this.peerConnection.setLocalDescription(offer);

      this.dataService.sendMessage({ type: 'offer', data: offer })
    } catch (err) {
      this.handleGetUserMediaError(err);
    }
  }
  handleGetUserMediaError(err: Error) {
    switch (err.name) {
      case 'NotFoundError':
        alert('alert unable to open your call becaise no camera and/or microphone found.')
        break;
      case 'SecurityError':
      case 'PermissionDeniedError':
        //Do nothing
        break;
      default:
        console.log(err);
        alert('Error opening your camera ' + err.message);
        break;
    }
    this.closeVideoCall();
  }

  createPeerConnection(): void {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: ['stun:stun.kundserver.de:3478', 'stun:stun.barracuda.com:3478']
        }
      ]
    });

    this.peerConnection.onicecandidate = this.handleIceCandidateEvent;
    this.peerConnection.oniceconnectionstatechange = this.handleIceConnectionStateChangeEvent;
    this.peerConnection.onsignalingstatechange = this.handleSignalingStateChangeEvent;
    this.peerConnection.ontrack = this.handleSignalingTrackEvent;

  }

  private closeVideoCall(): void {
    if (this.peerConnection) {
      this.peerConnection.onicecandidate = null;
      this.peerConnection.oniceconnectionstatechange = null;
      this.peerConnection.onsignalingstatechange = null;
      this.peerConnection.ontrack = null;
    }

    this.peerConnection.getTransceivers().forEach(transceiver => {
      transceiver.stop();
    });

    this.peerConnection.close();
    this.peerConnection = null;
  }


  private handleIceCandidateEvent = (event: RTCPeerConnectionIceEvent) => {
    console.log(event);
    if (event.candidate) {
      this.dataService.sendMessage({ type: 'ice-candidate', data: event.candidate })
    }
  }
  private handleIceConnectionStateChangeEvent = (event: Event) => {
    console.log(event);
    switch (this.peerConnection.iceConnectionState) {
      case 'closed':
      case 'failed':
      case 'disconnected':
        this.closeVideoCall();
        break;
    }
  }
  private handleSignalingStateChangeEvent = (event: Event) => {
    console.log(event);
    switch (this.peerConnection.signalingState) {
      case 'closed':
        this.closeVideoCall();
        break;
    }
  }
  private handleSignalingTrackEvent = (event: RTCTrackEvent) => {
    console.log('remoteVideo ',event);
    this.remoteVideo.nativeElement.srcObject = event.streams[0]
  }

  private addIncomingMessageHandler() {
    this.dataService.connect();

    this.dataService.messages$.subscribe(
      msg => {
        switch (msg.type) {
          case 'offer':
            this.handleOfferMessage(msg.data);
            break;
          case 'answer':
            this.handleAnswerMessage(msg.data);
            break;
          case 'hangup':
            this.handleHangupMessage(msg);
            break;
          case 'ice-candidate':
            this.handleICECandidateMessage(msg.data);
            break;
          default:
            console.log('unknown message of type ' + msg.type);

        }
      },
      error => {
        console.log(error);
      }
    );
  }

  private handleICECandidateMessage(data: any) {
    this.peerConnection.addIceCandidate(data).catch(this.reportError);
  }
  private reportError(e: any) {
    console.log('got Error: ' + e.name);
    console.log(e);

  }
  private handleHangupMessage(msg: Message): void {
    this.closeVideoCall();
  }
  private handleAnswerMessage(data: any): void {
    this.peerConnection.setRemoteDescription(data);
  }
  private handleOfferMessage(msg: RTCSessionDescriptionInit) {
    if (!this.peerConnection) {
      this.createPeerConnection();
    }

    if (!this.localStream) {
      this.startLocalVideo();
    }

    this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg))
      .then(() => {
        this.localVideo.nativeElement.srcObject = this.localStream;

        this.localStream.getTracks().forEach(
          track => this.peerConnection.addTrack(track, this.localStream))
      })
      .then(() => {
        return this.peerConnection.createAnswer();
      })
      .then((answer) => {
        return this.peerConnection.setLocalDescription(answer);
      })
      .then(() => {
        this.dataService.sendMessage({ type: 'answer', data: this.peerConnection.localDescription })
      })
      .catch(this.handleGetUserMediaError);
  }

  hangUp(): void {
    this.dataService.sendMessage({ type: 'hangup', data: '' });
    this.closeVideoCall();
  }



}
