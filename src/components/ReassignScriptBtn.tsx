import { useUserQuery } from "@/hooks/queries/useUserQueries";
import { useAssignScriptsMutation } from "@/hooks/mutations/useScriptMutations";

const ReAssignScript = () => {
  const { data: user } = useUserQuery();
  const assignScriptsMutation = useAssignScriptsMutation();

  const reAssignScriptForFailback = async () => {
    if (!user?.id) {
      console.error("[ReAssignScript] user id issue", user);
      alert("스크립트 재할당 실패, 다시 로그인해 주세요");
      return;
    }

    try {
      const assignResult = await assignScriptsMutation.mutateAsync({
        userId: user.id,
        currentSetNumber: user.participation?.currentSetNumber || 1,
      });
      console.log("스크립트 재할당 성공:", assignResult);
    } catch (err) {
      console.error("스크립트 재할당 실패:", err);
      alert("스크립트 재할당 중 오류가 발생했습니다.");
    }
  };

  if (!user) return null;

  return (
    <button onClick={reAssignScriptForFailback}>
      스크립트 다시 받기(눌러주세요!)
    </button>
  );
};

export default ReAssignScript;
