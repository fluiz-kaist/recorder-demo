  
  import { ScriptType, SituationalScript, FormalScript } from "@/types/firebase";
  
  type AnyScript = SituationalScript | FormalScript;
  // 타입별로 다른 고유 키 생성 함수
  export const getUniqueKey = (script: AnyScript, type: ScriptType): string => {
    console.log("script데이터")
    const taskKey =
      "task_key" in script && script.task_key ? script.task_key : "";
    const id = "id" in script && script.id ? script.id : "";

    // formal 타입만 task_key + id 조합
    if (type === ScriptType.FORMAL && taskKey && id) {
      return `${taskKey}-${id}`;
    }

    // situational은 항상 task_key만 사용
    return taskKey || String(id) || "";
  };


