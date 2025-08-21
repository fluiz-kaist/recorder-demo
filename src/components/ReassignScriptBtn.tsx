import { useUserQuery } from "@/hooks/queries/useUserQueries";
import { useAssignScriptsMutation } from "@/hooks/mutations/useScriptMutations";
import { useState } from "react";

const ReAssignScript = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { data: user } = useUserQuery();
  const assignScriptsMutation = useAssignScriptsMutation();

  const reAssignScriptForFailback = async () => {
    if (!user?.profile.userId) {
      console.error("[ReAssignScript] user id issue", user);
      alert("스크립트 재할당 실패, 다시 로그인해 주세요");
      return;
    }

    setIsLoading(true); // 로딩 시작
    // alert("대본을 다시 받아오고 있습니다. 잠시만 기다려주세요."); // 즉시 피드백

    try {
      const assignResult = await assignScriptsMutation.mutateAsync({
        userId: user.profile.userId,
        currentSetNumber: user.currentStatus?.currentRoundNumber || 1,
      });
      console.log("스크립트 재할당 성공:", assignResult);
      if (confirm("성공적으로 다시 할당 받았습니다!")) {
        window.location.reload();
      }
    } catch (err) {
      console.error("스크립트 재할당 실패:", err);
      alert("대본 재할당 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false); // 로딩 종료
    }
  };

  if (!user) return null;

  return (
    <button
      onClick={reAssignScriptForFailback}
      disabled={isLoading}
      style={{
        width: "200px",
        height: "60px",
        fontSize: "20px",
        fontWeight: "bold",
        backgroundColor: isLoading ? "#ccc" : "#2196F3",
        color: "white",
        border: "none",
        borderRadius: "8px",
        cursor: isLoading ? "not-allowed" : "pointer",
        boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
        touchAction: "manipulation",
        marginBottom: "20px",
      }}
    >
      {isLoading ? "⏳ 대본 받아오는 중..." : "대본 다시 받기"}
    </button>
  );
};

export default ReAssignScript;
