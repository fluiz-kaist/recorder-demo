import { useEffect, useRef } from "react";
import { formatFirestoreTimestampKST } from "@/utils/time";
import { AudioRecording } from "@/types/audio";

interface PopupManagerProps {
  recording: AudioRecording | null;
  onClose: () => void;
}

const PopupManager: React.FC<PopupManagerProps> = ({ recording, onClose }) => {
  const popupWindowRef = useRef<Window | null>(null);

  const generateFullHTML = (recording: AudioRecording) => {
    const formatFileSize = (bytes: number) => {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    const formatDuration = (seconds: number) => {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>녹음 상세 정보 - ${recording.taskKey}</title>
        <meta charset="utf-8">
        <style>
          body { 
            margin: 0; 
            padding: 20px; 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #f8f9fa;
          }
          .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
            max-width: 800px;
            margin: 0 auto;
            overflow: hidden;
            border: 1px solid #e5e5e5;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px 12px;
            border-bottom: 1px solid #e5e5e5;
            background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
          }
          .header h2 {
            margin: 0 0 2px 0;
            font-size: 16px;
            font-weight: 600;
            color: #2c3e50;
          }
          .recording-id {
            font-size: 11px;
            color: #7f8c8d;
            font-family: Monaco, Menlo, monospace;
            background: #ecf0f1;
            padding: 1px 6px;
            border-radius: 3px;
          }
          .close-btn {
            background: #e74c3c;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
          }
          .close-btn:hover { background: #c0392b; }
          .tabs {
            display: flex;
            border-bottom: 1px solid #e5e5e5;
            background: #f8f9fa;
            padding: 0 20px;
          }
          .tab {
            background: none;
            border: none;
            padding: 12px 16px;
            font-size: 12px;
            color: #7f8c8d;
            cursor: pointer;
            border-bottom: 2px solid transparent;
          }
          .tab.active {
            color: #3498db;
            border-bottom-color: #3498db;
            background: white;
          }
          .content {
            padding: 20px;
            background: white;
          }
          .tab-content { display: none; }
          .tab-content.active { display: block; }
          .section { margin-bottom: 24px; }
          .section h3 {
            margin: 0 0 12px 0;
            font-size: 14px;
            font-weight: 600;
            color: #2c3e50;
            padding-bottom: 6px;
            border-bottom: 1px solid #ecf0f1;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
          .info-item {
            background: #f8f9fa;
            padding: 12px;
            border-radius: 6px;
          }
          .info-item label {
            display: block;
            font-size: 11px;
            font-weight: 500;
            color: #7f8c8d;
            margin-bottom: 3px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          .info-item span {
            font-size: 13px;
            color: #2c3e50;
            font-weight: 500;
          }
          .text-box {
            background: #f8f9fa;
            border: 1px solid #e5e5e5;
            border-radius: 6px;
            padding: 12px;
            font-size: 13px;
            line-height: 1.5;
            color: #2c3e50;
            white-space: pre-wrap;
            min-height: 50px;
            max-height: 120px;
            overflow-y: auto;
          }
          .type-badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 15px;
            font-size: 11px;
            font-weight: 600;
            text-align: center;
          }
          .type-situational { background: #e8f5e8; color: #27ae60; }
          .type-formal { background: #fdf2e8; color: #e67e22; }
          .task-key {
            font-family: Monaco, Menlo, monospace;
            background: #e8f4fd;
            color: #2980b9;
            padding: 3px 6px;
            border-radius: 3px;
          }
          .download-btn {
            background: #3498db;
            color: white;
            padding: 12px 24px;
            border-radius: 5px;
            text-decoration: none;
            display: inline-block;
            margin-top: 20px;
            font-size: 13px;
          }
          .download-btn:hover { background: #2980b9; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div>
              <h2>녹음 데이터 상세</h2>
              <span class="recording-id">ID: ${recording.id.substring(
                0,
                8
              )}...</span>
            </div>
            <button class="close-btn" onclick="window.close()">✕ 닫기</button>
          </div>

          <div class="tabs">
            <button class="tab active" onclick="showTab('basic', this)">📊 기본</button>
            <button class="tab" onclick="showTab('text', this)">📝 텍스트</button>
            <button class="tab" onclick="showTab('quality', this)">🎯 품질</button>
            <button class="tab" onclick="showTab('verification', this)">✓ 검증</button>
          </div>

          <div class="content">
            <div id="basic" class="tab-content active">
              <div class="section">
                <h3>🎤 녹음 기본 정보</h3>
                <div class="info-grid">
                  <div class="info-item">
                    <label>태스크 키</label>
                    <span class="task-key">${recording.taskKey}</span>
                  </div>
                  <div class="info-item">
                    <label>태스크 타입</label>
                    <span class="type-badge ${
                      recording.taskType === "situational"
                        ? "type-situational"
                        : "type-formal"
                    }">
                      ${
                        recording.taskType === "situational"
                          ? "상황발화"
                          : "정형발화"
                      }
                    </span>
                  </div>
                  <div class="info-item">
                    <label>파일명</label>
                    <span>${recording.fileName}</span>
                  </div>
                  <div class="info-item">
                    <label>업로드 시간</label>
                    <span>${formatFirestoreTimestampKST(
                      recording.uploadedAt
                    )}</span>
                  </div>
                </div>
              </div>

              <div class="section">
                <h3>👤 화자 정보</h3>
                <div class="info-grid">
                  <div class="info-item">
                    <label>사용자명</label>
                    <span>${
                      recording.speakerInfo?.userName || "이름 없음"
                    }</span>
                  </div>
                  <div class="info-item">
                    <label>성별</label>
                    <span>${recording.speakerInfo?.gender || "불명"}</span>
                  </div>
                  <div class="info-item">
                    <label>연령대</label>
                    <span>${recording.speakerInfo?.ageGroup || "불명"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div id="text" class="tab-content">
              <div class="section">
                <h3>📋 메타데이터</h3>
                <div class="info-grid">
                  <div class="info-item">
                    <label>도메인</label>
                    <span>${recording.textData?.domain || "도메인 없음"}</span>
                  </div>
                  <div class="info-item">
                    <label>의도</label>
                    <span>${recording.textData?.intent || "의도 없음"}</span>
                  </div>
                </div>
              </div>

              <div class="section">
                <h3>📄 원본 스크립트</h3>
                <div class="text-box">${
                  recording.textData?.originalScript ||
                  "원본 스크립트가 없습니다."
                }</div>
              </div>

              <div class="section">
                <h3>🎯 STT 변환 결과</h3>
                <div class="text-box">${
                  recording.textData?.sttTranscription || "STT 결과가 없습니다."
                }</div>
              </div>
            </div>

            <div id="quality" class="tab-content">
              <div class="section">
                <h3>📈 기본 품질 지표</h3>
                <div class="info-grid">
                  <div class="info-item">
                    <label>재생 시간</label>
                    <span>${formatDuration(
                      recording.qualityCheck?.duration || 0
                    )}</span>
                  </div>
                  <div class="info-item">
                    <label>파일 크기</label>
                    <span>${formatFileSize(
                      recording.qualityCheck?.fileSize || 0
                    )}</span>
                  </div>
                  <div class="info-item">
                    <label>품질 등급</label>
                    <span>${
                      recording.qualityCheck?.qualityGrade === "high"
                        ? "높음"
                        : recording.qualityCheck?.qualityGrade === "medium"
                        ? "보통"
                        : "낮음"
                    }</span>
                  </div>
                </div>
              </div>
            </div>

            <div id="verification" class="tab-content">
              <div class="section">
                <h3>✅ 검증 상태</h3>
                <div class="info-grid">
                  <div class="info-item">
                    <label>검증 상태</label>
                    <span>${recording.verificationStatus}</span>
                  </div>
                </div>
              </div>
            </div>

            <a href="${recording.audioUrl}" download="${
      recording.fileName
    }" class="download-btn" target="_blank">
              📥 오디오 다운로드
            </a>
          </div>
        </div>

        <script>
          function showTab(tabName, element) {
            // 모든 탭 내용 숨기기
            const contents = document.querySelectorAll('.tab-content');
            contents.forEach(content => content.classList.remove('active'));
            
            // 모든 탭 버튼 비활성화
            const tabs = document.querySelectorAll('.tab');
            tabs.forEach(tab => tab.classList.remove('active'));
            
            // 선택된 탭 활성화
            document.getElementById(tabName).classList.add('active');
            element.classList.add('active');
          }
        </script>
      </body>
      </html>
    `;
  };

  useEffect(() => {
    if (recording) {
      if (popupWindowRef.current && !popupWindowRef.current.closed) {
        popupWindowRef.current.focus();
        return;
      }

      const newWindow = window.open(
        "",
        `recording-detail-${recording.id}`,
        "width=800,height=700,scrollbars=yes,resizable=yes"
      );

      if (newWindow) {
        popupWindowRef.current = newWindow;

        // 🔥 완전한 HTML을 직접 작성
        newWindow.document.write(generateFullHTML(recording));
        newWindow.document.close();

        const handleUnload = () => {
          console.log("팝업 창이 닫혔습니다"); // 디버깅용
          onClose(); // 이게 호출되고 있는지 확인
        };
        newWindow.addEventListener("unload", handleUnload);

        return () => {
          newWindow.removeEventListener("unload", handleUnload);
        };
      }
    }
  }, [recording, onClose]);

  return null; // 팝업은 별도 창이므로 현재 DOM에는 아무것도 렌더링하지 않음
};

export default PopupManager;
