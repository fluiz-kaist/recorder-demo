import { useState, useEffect, useMemo, useCallback, memo } from "react";
import styles from "@/styles/AdminDashboard.module.css";
import { VerificationStatus } from "@/types/audio";

// 커스텀 디바운스 훅
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// 디바운스된 텍스트영역 컴포넌트
const DebouncedTextarea = memo(
  ({
    value,
    onChange,
    debounceMs = 300,
    className,
    ...props
  }: {
    value: string;
    onChange: (value: string) => void;
    debounceMs?: number;
    className?: string;
    [key: string]: any;
  }) => {
    const [localValue, setLocalValue] = useState(value);
    const debouncedValue = useDebounce(localValue, debounceMs);

    // 외부에서 value가 변경되면 로컬 상태도 업데이트
    useEffect(() => {
      setLocalValue(value);
    }, [value]);

    // 디바운스된 값이 변경되면 부모 컴포넌트에 알림
    useEffect(() => {
      if (debouncedValue !== value) {
        onChange(debouncedValue);
      }
    }, [debouncedValue, value, onChange]);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setLocalValue(e.target.value);
      },
      []
    );

    return (
      <textarea
        {...props}
        value={localValue}
        onChange={handleChange}
        className={className}
      />
    );
  }
);

DebouncedTextarea.displayName = "DebouncedTextarea";

// 검증 결과 아이템 인터페이스
export interface ValidationResultItem {
  recordingId: string;
  verificationStatus: VerificationStatus;
  isApproved?: boolean;
  reasoning: string;
  confidence: number;
  isSelected?: boolean;
  userModified?: boolean;
  textModified?: boolean;
  textData: {
    originalScript: string;
    sttTranscription: string;
    domain: string;
    intent: string;
    category: string;
  };
}

// 업데이트 요청 인터페이스
interface ValidationUpdateRequest {
  validationResults: Array<{
    recordingId: string;
    isApproved: boolean;
    reasoning: string;
    confidence?: number;
    textData?: {
      sttTranscription?: string;
      domain?: string;
      intent?: string;
      category?: string;
    };
  }>;
  updateOptions?: {
    verificationMethod?: "llm_auto" | "llm_manual" | "test";
    verifiedBy?: string;
    overrideExisting?: boolean;
  };
}

// 업데이트 응답 인터페이스
interface ValidationUpdateResponse {
  success: boolean;
  data?: {
    updatedCount: number;
    approvedCount: number;
    rejectedCount: number;
    skippedCount: number;
    recordingIds: string[];
    processingTime: number;
  };
  message?: string;
  errors?: Array<{
    recordingId: string;
    error: string;
  }>;
}

// 메모화된 개별 아이템 컴포넌트
const ValidationResultItem = memo(
  ({
    result,
    editedTextData,
    expandedItems,
    isUpdating,
    onToggleSelection,
    onToggleApproval,
    onToggleExpand,
    onUpdateReasoning,
    onUpdateSttTranscription,
  }: {
    result: ValidationResultItem;
    editedTextData: Record<string, any>;
    expandedItems: Set<string>;
    isUpdating: boolean;
    onToggleSelection: (id: string) => void;
    onToggleApproval: (id: string) => void;
    onToggleExpand: (id: string) => void;
    onUpdateReasoning: (id: string, value: string) => void;
    onUpdateSttTranscription: (id: string, value: string) => void;
  }) => {
    // useCallback으로 최적화
    const handleToggleSelection = useCallback(() => {
      onToggleSelection(result.recordingId);
    }, [result.recordingId, onToggleSelection]);

    const handleToggleApproval = useCallback(() => {
      onToggleApproval(result.recordingId);
    }, [result.recordingId, onToggleApproval]);

    const handleToggleExpand = useCallback(() => {
      onToggleExpand(result.recordingId);
    }, [result.recordingId, onToggleExpand]);

    const handleReasoningChange = useCallback(
      (newValue: string) => {
        onUpdateReasoning(result.recordingId, newValue);
      },
      [result.recordingId, onUpdateReasoning]
    );

    const handleSttChange = useCallback(
      (newValue: string) => {
        onUpdateSttTranscription(result.recordingId, newValue);
      },
      [result.recordingId, onUpdateSttTranscription]
    );

    //계산된 값들을 useMemo로 최적화
    const statusDisplay = useMemo(() => {
      switch (result.verificationStatus) {
        case VerificationStatus.PENDING:
          return {
            text: "🔄 검토 대기",
            className: "status-pending",
            bgColor: "#fef3c7",
          };
        case VerificationStatus.APPROVED:
          return {
            text: "✅ 승인",
            className: "status-approved",
            bgColor: "#d1fae5",
          };
        case VerificationStatus.REJECTED:
          return {
            text: "❌ 반려",
            className: "status-rejected",
            bgColor: "#fee2e2",
          };
        case VerificationStatus.NEEDS_RETRY:
          return {
            text: "🔁 재시도 필요",
            className: "status-retry",
            bgColor: "#fde68a",
          };
        default:
          return {
            text: "❓ 알 수 없음",
            className: "status-unknown",
            bgColor: "#f3f4f6",
          };
      }
    }, [result.verificationStatus]);

    const isExpanded = useMemo(
      () => expandedItems.has(result.recordingId),
      [expandedItems, result.recordingId]
    );

    const currentReasoning = useMemo(
      () => editedTextData[result.recordingId]?.reasoning ?? result.reasoning,
      [editedTextData, result.recordingId, result.reasoning]
    );

    const currentSttTranscription = useMemo(
      () =>
        editedTextData[result.recordingId]?.sttTranscription ??
        result.textData.sttTranscription,
      [editedTextData, result.recordingId, result.textData.sttTranscription]
    );

    const isReasoningModified = useMemo(
      () => editedTextData[result.recordingId]?.reasoning !== undefined,
      [editedTextData, result.recordingId]
    );

    const isSttModified = useMemo(
      () => editedTextData[result.recordingId]?.sttTranscription !== undefined,
      [editedTextData, result.recordingId]
    );

    return (
      <div
        className={`${styles.validationResultItem} ${
          result.userModified ? styles.userModified : ""
        } ${!result.isSelected ? styles.unselected : ""}`}
      >
        {/* 선택 체크박스 */}
        <div className={styles.selectionControl}>
          <input
            type="checkbox"
            checked={result.isSelected || false}
            onChange={handleToggleSelection}
            className={styles.checkbox}
            disabled={isUpdating}
          />
        </div>

        {/* 레코딩 ID */}
        <div className={styles.recordingIdSection}>
          <span className={styles.recordingId}>{result.recordingId}</span>
          {result.userModified && (
            <span className={styles.modifiedBadge} title="사용자가 수정함">
              ✏️
            </span>
          )}
        </div>

        {/* 승인/반려 토글 */}
        <div className={styles.approvalControl}>
          <button
            onClick={handleToggleApproval}
            className={`${styles.approvalToggle} ${
              result.isApproved ? styles.approved : styles.rejected
            }`}
            disabled={isUpdating || !result.isSelected}
            title={
              result.isApproved
                ? "승인됨 (클릭하여 반려로 변경)"
                : "반료됨 (클릭하여 승인으로 변경)"
            }
          >
            <span
              className={statusDisplay.className}
              style={{
                backgroundColor: statusDisplay.bgColor,
              }}
            >
              {statusDisplay.text}
            </span>
          </button>
        </div>

        {/* 신뢰도 */}
        <div className={styles.confidenceSection}>
          <span className={styles.confidenceLabel}>신뢰도:</span>
          <span
            className={`${styles.confidenceValue} ${
              result.confidence >= 0.9
                ? styles.highConfidence
                : result.confidence >= 0.7
                ? styles.mediumConfidence
                : styles.lowConfidence
            }`}
          >
            {Math.round(result.confidence * 100)}%
          </span>
        </div>

        {/* 확장 버튼 */}
        <div className={styles.expandControl}>
          <button
            onClick={handleToggleExpand}
            className={`${styles.expandButton} ${
              isExpanded ? styles.expanded : ""
            }`}
            disabled={isUpdating}
            title={isExpanded ? "텍스트 편집 접기" : "텍스트 편집 펼치기"}
          >
            {isExpanded ? "🔼" : "🔽"}
          </button>
        </div>

        {/* 디바운스된 검증 이유 */}
        <div className={styles.reasoningSection}>
          <label className={styles.reasoningLabel}>
            🤔 검증 이유
            {isReasoningModified && (
              <span style={{ color: "#28a745", marginLeft: "4px" }}>✏️</span>
            )}
          </label>
          <DebouncedTextarea
            value={currentReasoning}
            onChange={handleReasoningChange}
            className={`${styles.reasoningTextArea} ${
              isReasoningModified ? styles.modified : ""
            }`}
            placeholder="검증 이유를 입력하세요"
            disabled={isUpdating || !result.isSelected}
            rows={3}
            debounceMs={300} // 300ms 디바운스
          />
        </div>

        {/* 텍스트 편집 섹션 */}
        {isExpanded && (
          <div className={styles.textEditSection}>
            <div className={styles.textComparisonGrid}>
              {/* 원본 스크립트 */}
              <div className={styles.textField}>
                <label className={styles.textFieldLabel}>
                  📝 원본 스크립트
                </label>
                <textarea
                  value={result.textData.originalScript}
                  readOnly
                  className={styles.textArea}
                  placeholder="원본 스크립트가 없습니다"
                />
              </div>

              {/*  디바운스된 STT 전사 결과 */}
              <div className={styles.textField}>
                <label className={styles.textFieldLabel}>
                  🎤 STT 전사 결과
                  {isSttModified && (
                    <span style={{ color: "#28a745", marginLeft: "4px" }}>
                      🔤
                    </span>
                  )}
                </label>
                <DebouncedTextarea
                  value={currentSttTranscription}
                  onChange={handleSttChange}
                  className={`${styles.textArea} ${
                    isSttModified ? styles.modified : ""
                  }`}
                  placeholder="STT 전사 결과를 입력하세요"
                  disabled={isUpdating || !result.isSelected}
                  debounceMs={500} // STT는 더 긴 디바운스 (500ms)
                />
              </div>
            </div>

            {/* 추가 정보 */}
            <div className={styles.textComparisonGrid}>
              <div className={styles.textField}>
                <label className={styles.textFieldLabel}>🏷️ 도메인</label>
                <input
                  type="text"
                  value={result.textData.domain}
                  readOnly
                  className={styles.textArea}
                  style={{ minHeight: "auto", height: "32px" }}
                />
              </div>
              <div className={styles.textField}>
                <label className={styles.textFieldLabel}>🎯 의도</label>
                <input
                  type="text"
                  value={result.textData.intent}
                  readOnly
                  className={styles.textArea}
                  style={{ minHeight: "auto", height: "32px" }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

ValidationResultItem.displayName = "ValidationResultItem";

interface LLMValidationReviewProps {
  validationResults: ValidationResultItem[];
  onUpdateComplete: (result: ValidationUpdateResponse) => void;
  onClose: () => void;
}

const LLMValidationReview = ({
  validationResults,
  onUpdateComplete,
}: LLMValidationReviewProps) => {
  const [results, setResults] = useState<ValidationResultItem[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectAll, setSelectAll] = useState(false);
  const [editedTextData, setEditedTextData] = useState<Record<string, any>>({});
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  console.log("validationResults?", validationResults);

  useEffect(() => {
    if (validationResults && validationResults.length > 0) {
      const initialResults = validationResults.map((result) => ({
        ...result,
        isSelected: false,
        userModified: false,
        isApproved:
          result.isApproved ??
          result.verificationStatus === VerificationStatus.APPROVED,
      }));

      setResults(initialResults);
    }
  }, [validationResults]);

  // 콜백들을 useCallback으로 최적화 - 불필요한 재렌더링 방지
  const toggleApproval = useCallback((recordingId: string) => {
    setResults((prev) =>
      prev.map((result) =>
        result.recordingId === recordingId
          ? {
              ...result,
              isApproved: !result.isApproved,
              userModified: true,
            }
          : result
      )
    );
  }, []);

  const toggleSelection = useCallback((recordingId: string) => {
    setResults((prev) => {
      const newResults = prev.map((result) =>
        result.recordingId === recordingId
          ? { ...result, isSelected: !result.isSelected }
          : result
      );

      const selectedCount = newResults.filter((r) => r.isSelected).length;
      const allSelected = newResults.every((r) => r.isSelected);

      setSelectAll(allSelected);
      return newResults;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    setResults((prev) =>
      prev.map((result) => ({
        ...result,
        isSelected: newSelectAll,
      }))
    );
  }, [selectAll]);

  const toggleExpand = useCallback((recordingId: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(recordingId)) {
        newSet.delete(recordingId);
      } else {
        newSet.add(recordingId);
      }
      return newSet;
    });
  }, []);

  // 디바운스된 텍스트 업데이트 함수들
  const updateReasoning = useCallback(
    (recordingId: string, newReasoning: string) => {
      console.log(
        `💾 검증 이유 업데이트 (${recordingId}): "${newReasoning.slice(
          0,
          50
        )}..."`
      );

      setEditedTextData((prev) => ({
        ...prev,
        [recordingId]: {
          ...prev[recordingId],
          reasoning: newReasoning,
        },
      }));

      setResults((prev) =>
        prev.map((result) =>
          result.recordingId === recordingId
            ? { ...result, userModified: true }
            : result
        )
      );
    },
    []
  );

  const updateSttTranscription = useCallback(
    (recordingId: string, newValue: string) => {
      console.log(
        `💾 STT 전사 업데이트 (${recordingId}): "${newValue.slice(0, 50)}..."`
      );

      setEditedTextData((prev) => ({
        ...prev,
        [recordingId]: {
          ...prev[recordingId],
          sttTranscription: newValue,
        },
      }));

      setResults((prev) =>
        prev.map((result) =>
          result.recordingId === recordingId
            ? { ...result, textModified: true, userModified: true }
            : result
        )
      );
    },
    []
  );

  // 계산 결과를 useMemo로 캐시
  const selectedResults = useMemo(
    () => results.filter((result) => result.isSelected === true),
    [results]
  );

  const statistics = useMemo(() => {
    const total = selectedResults.length;
    const approved = selectedResults.filter((r) => r.isApproved).length;
    const rejected = total - approved;
    const modified = selectedResults.filter((r) => r.userModified).length;
    return { total, approved, rejected, modified };
  }, [selectedResults]);

  const handleUpdate = useCallback(async () => {
    if (selectedResults.length === 0) {
      alert("업데이트할 항목을 선택해주세요.");
      return;
    }

    setIsUpdating(true);

    try {
      const updateRequest: ValidationUpdateRequest = {
        validationResults: selectedResults.map((result) => {
          const requestItem = {
            recordingId: result.recordingId,
            isApproved: result.isApproved ?? false,
            reasoning:
              editedTextData[result.recordingId]?.reasoning ?? result.reasoning,
            confidence: result.confidence,
            ...(editedTextData[result.recordingId] && {
              textData: editedTextData[result.recordingId],
            }),
          };

          return requestItem;
        }),
        updateOptions: {
          verificationMethod: selectedResults.some((r) => r.userModified)
            ? "llm_manual"
            : "llm_auto",
          verifiedBy: "admin",
          overrideExisting: true,
        },
      };

      console.log("최종 업데이트 요청:", updateRequest);

      const response = await fetch(
        "/api/admin/recordings/llm-validation/update",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateRequest),
        }
      );

      const result: ValidationUpdateResponse = await response.json();
      console.log("서버 응답:", result);

      onUpdateComplete(result);
    } catch (error) {
      console.error("업데이트 실패:", error);
      onUpdateComplete({
        success: false,
        message: `업데이트 중 오류가 발생했습니다: ${error}`,
      });
    } finally {
      setIsUpdating(false);
    }
  }, [selectedResults, editedTextData, onUpdateComplete]);

  return (
    <>
      <div className={styles.validationReviewSection}>
        {/* 헤더 */}
        <div className={styles.reviewHeader}>
          <h3>LLM 검증 결과 검토</h3>
          <p style={{ fontSize: "12px", color: "#666", margin: "4px 0" }}>
            💡 디바운스 적용: 텍스트 입력 후 자동 저장 (검증 이유: 300ms, STT:
            500ms)
          </p>
        </div>

        {/* 통계 정보 - 메모화로 불필요한 재렌더링 방지 */}
        <div className={styles.reviewStats}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>선택된 항목</span>
            <span className={styles.statValue}>{statistics.total}개</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>승인</span>
            <span className={styles.statValue}>{statistics.approved}개</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>반려</span>
            <span className={styles.statValue}>{statistics.rejected}개</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>수정됨</span>
            <span className={styles.statValue}>{statistics.modified}개</span>
          </div>
        </div>

        {/* 전체 선택 컨트롤 */}
        <div className={styles.selectAllControl}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={selectAll}
              onChange={toggleSelectAll}
              className={styles.checkbox}
              disabled={isUpdating}
            />
            <span>전체 선택</span>
          </label>
        </div>

        {/*  결과 목록: 각 아이템이 독립적으로 렌더링 */}
        <div className={styles.validationResultsList}>
          {results.map((result) => (
            <ValidationResultItem
              key={result.recordingId}
              result={result}
              editedTextData={editedTextData}
              expandedItems={expandedItems}
              isUpdating={isUpdating}
              onToggleSelection={toggleSelection}
              onToggleApproval={toggleApproval}
              onToggleExpand={toggleExpand}
              onUpdateReasoning={updateReasoning}
              onUpdateSttTranscription={updateSttTranscription}
            />
          ))}
        </div>

        {/* 액션 버튼들 */}
        <div className={styles.modalActions}>
          <button
            onClick={handleUpdate}
            className={`${styles.updateButton} ${
              isUpdating ? styles.updating : ""
            }`}
            disabled={isUpdating || statistics.total === 0}
          >
            {isUpdating ? (
              <>
                <span className={styles.spinner}>🔄</span>
                업데이트 중... ({statistics.total}개)
              </>
            ) : (
              `🔄 검증 결과 업데이트 (${statistics.total}개)`
            )}
          </button>
        </div>

        {/* 도움말 */}
        <div className={styles.helpSection}>
          <h4>💡 사용법</h4>
          <ul>
            <li>
              <strong>승인/반료 토글:</strong> ✅❌ 버튼을 클릭하여 LLM 판정을
              수정할 수 있습니다
            </li>
            <li>
              <strong>선택적 업데이트:</strong> 체크박스로 업데이트할 항목만
              선택할 수 있습니다
            </li>
            <li>
              <strong>수정 표시:</strong> ✏️ 아이콘으로 사용자가 수정한 항목을
              확인할 수 있습니다
            </li>
            <li>
              <strong>자동 저장:</strong> 텍스트 입력 후 잠시 뒤 자동으로 로컬에
              저장됩니다
            </li>
            <li>
              <strong>신뢰도 참고:</strong> LLM의 판정 신뢰도를 참고하여
              검토하세요
            </li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default LLMValidationReview;
