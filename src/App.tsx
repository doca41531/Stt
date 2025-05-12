import React, { useEffect, useRef, useState } from 'react';
import './assets/style.css';

const VoiceRecorderWithVisualizer: React.FC = () => {
  const animationRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [SttText, setSttText] = useState<string | null>("버튼을 누르고 말한 뒤 다시 버튼을 눌러주세요");

  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  const drawVisualizer = (analyser: AnalyserNode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i];
        ctx.fillStyle = `rgb(${barHeight + 100},50,150)`;
        ctx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);
        x += barWidth + 1;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const startRecording = () => {
    if (!mediaRecorderRef.current) return;
    audioChunksRef.current = [];
    mediaRecorderRef.current.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    setSttText("응답이 오는데 조금 걸릴 수 있습니다.")
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  useEffect(() => {
    const initAudioVisualizer = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        source.connect(analyser);
        drawVisualizer(analyser);

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
          }
          audioContext.close();

          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('file', audioBlob, 'recording.webm');

          try {
            const response = await fetch('https://sttback.onrender.com/stt/upload', {
              method: 'POST',
              body: formData,
            });
            const result = await response.json();
            setSttText(result.transcript);
          } catch (err) {
            console.error('업로드 오류:', err);
          }
        };
      } catch (err) {
        console.error('마이크 접근 실패:', err);
      }
    };

    initAudioVisualizer();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      audioContextRef.current?.close();
    };
  }, []);

  return (
    <div className="p-4">
      <a href="http://222.110.147.50:3342/index.html"><svg className="back" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M380.6 81.7c7.9 15.8 1.5 35-14.3 42.9L103.6 256 366.3 387.4c15.8 7.9 22.2 27.1 14.3 42.9s-27.1 22.2-42.9 14.3l-320-160C6.8 279.2 0 268.1 0 256s6.8-23.2 17.7-28.6l320-160c15.8-7.9 35-1.5 42.9 14.3z"/></svg></a>
      <canvas ref={canvasRef} width={600} height={150} className="mb-4 border rounded bg-black" />

      <div className="recorder-container">
        <input
          type="checkbox"
          id="btn"
          checked={isRecording}
          onChange={() => {
            isRecording ? stopRecording() : startRecording();
          }}
        />
        <label htmlFor="btn"></label>
        <div className="time">
          <div className="h_m"></div>
          <div className="s_ms"></div>
        </div>
      </div>

      <div className="mt-4 bg-gray-100 rounded">
        <p className="font-mono text-sm">stt : {SttText && SttText}</p>
      </div>
    </div>
  );
};

export default VoiceRecorderWithVisualizer;
