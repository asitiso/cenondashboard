import { useEffect, useRef, useState } from "react";
import { Modal } from "./ImportPanels";
export function BarcodeCamera({
  onScan,
  onClose,
  onName,
}: {
  onScan: (code: string) => void;
  onClose: () => void;
  onName: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const scanned = useRef(false);
  const callbacks = useRef({ onScan });
  callbacks.current = { onScan };
  useEffect(() => {
    let live = true,
      stream: MediaStream | undefined,
      controls: { stop: () => void } | undefined;
    async function start() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
          throw Error(
            "카메라 촬영은 HTTPS 연결에서 사용할 수 있습니다. 상품명으로 찾거나 바코드를 입력하세요.",
          );
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!live) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromStream(
          stream,
          video.current!,
          (result, _error, control) => {
            if (result && live && !scanned.current) {
              scanned.current = true;
              control.stop();
              stream?.getTracks().forEach((t) => t.stop());
              callbacks.current.onScan(result.getText());
            }
          },
        );
        if (!live) controls.stop();
      } catch (e) {
        controls?.stop();
        stream?.getTracks().forEach((t) => t.stop());
        if (live)
          setError(
            e instanceof Error
              ? e.name === "NotAllowedError"
                ? "카메라 사용 권한이 필요합니다. 브라우저 설정에서 허용하거나 상품명으로 찾으세요."
                : e.message
              : String(e),
          );
      }
    }
    void start();
    return () => {
      live = false;
      controls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  return (
    <Modal title="바코드 촬영" onClose={onClose}>
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        <>
          <video ref={video} muted playsInline className="of-camera" />
          <p className="of-muted">바코드를 화면 가운데에 맞춰주세요.</p>
        </>
      )}
      <button onClick={onName}>상품명으로 찾기</button>
      <button onClick={onClose}>닫기</button>
    </Modal>
  );
}
