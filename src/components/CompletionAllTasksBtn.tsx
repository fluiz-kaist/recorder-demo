import { useRouter } from "next/router";
import { useUserQuery } from "@/hooks/queries/useUserQueries";
import styles from "@/styles/CompletionBtn.module.css";
const CompletionAllTasksBtn = () => {
  const { data: user } = useUserQuery();
  const router = useRouter();
  const handleCompleteAndProceed = () => {
    console.log("여기서 유저 정보가 어떨까?", user);
    // router.push("/finalStepPage");
  };
  return (
    <button
      onClick={handleCompleteAndProceed}
      className={styles.finishAllTasks}
    >
      <span>모든 작업 완료</span>
    </button>
  );
};

export default CompletionAllTasksBtn;
