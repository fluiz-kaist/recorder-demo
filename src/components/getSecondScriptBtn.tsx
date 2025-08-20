import { useState } from "react";
import { useUserQuery } from "@/hooks/queries/useUserQueries";
import { useAssignScriptsMutation } from "@/hooks/mutations/useScriptMutations";

const SecondRoundAssignBtn = () => {
  const { data: user } = useUserQuery();
  const assignScriptsMutation = useAssignScriptsMutation();
  const [isProcessing, setIsProcessing] = useState(false);

  const reAssignScriptForFailback = async () => {
    // 이미 처리 중이면 무시
    if (isProcessing || assignScriptsMutation.isPending) {
      return;
    }

    if (!user?.profile.userId) {
      console.error("[SecondRoundAssignBtn] user id issue", user);
      alert("2회차 과제 할당 받기 작업을 실패했습니다. 다시 로그인해 주세요");
      return;
    }

    setIsProcessing(true);

    try {
      const assignResult = await assignScriptsMutation.mutateAsync({
        userId: user.profile.userId,
        currentSetNumber: user.currentStatus?.currentRoundNumber || 1,
      });
      console.log("스크립트 재할당 성공:", assignResult);
      if (confirm("2회차에 할당된 과제를 성공적으로 다시 할당 받았습니다!")) {
        window.location.reload();
      }
    } catch (err) {
      console.error("스크립트 재할당 실패:", err);
      alert("2회차의 과제를 받는 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!user) return null;

  const isDisabled = isProcessing || assignScriptsMutation.isPending;

  return (
    <>
      <p>아래 버튼을 누른 후 2회차 작업을 시작해 주세요</p>
      <button
        onClick={reAssignScriptForFailback}
        disabled={isDisabled}
        style={{
          backgroundColor: isDisabled ? "#9e9e9e" : "#1a237e",
          color: "white",
          fontSize: "20px",
          fontWeight: "bold",
          padding: "18px 25px",
          border: "none",
          borderRadius: "12px",
          boxShadow: isDisabled ? "none" : "0 4px 12px rgba(0, 0, 0, 0.25)",
          minWidth: "280px",
          height: "70px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "15px auto",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "rgba(0, 0, 0, 0.1)",
          userSelect: "none",
          cursor: isDisabled ? "not-allowed" : "pointer",
          opacity: isDisabled ? 0.7 : 1,
          transition: "all 0.2s ease-in-out",
        }}
      >
        {isDisabled
          ? "할당된 과제를 받는 중입니다..."
          : "2회차 과제 받기 (여기를 눌러주세요!)"}
      </button>
    </>
  );
};

export default SecondRoundAssignBtn;
