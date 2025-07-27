import { useState } from "react";
import styles from "@/styles/AdminDashboard.module.css";

interface SearchFiltersProps {
  onFiltersChange: (filters: {
    search: string;
    taskType: "" | "situational" | "formal";
    domain: string;
  }) => void;
}

const RecordingTabSearchFilters = ({ onFiltersChange }: SearchFiltersProps) => {
  const [searchInput, setSearchInput] = useState("");
  const [taskType, setTaskType] = useState<"" | "situational" | "formal">("");
  const [domain, setDomain] = useState("");

  const handleSearch = () => {
    onFiltersChange({
      search: searchInput,
      taskType,
      domain,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleTaskTypeChange = (newTaskType: "" | "situational" | "formal") => {
    setTaskType(newTaskType);
    // 드롭다운은 즉시 적용
    onFiltersChange({
      search: searchInput,
      taskType: newTaskType,
      domain,
    });
  };

  return (
    <div className={styles.filtersContainer}>
      <input
        placeholder="사용자 이름으로 검색"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        onKeyPress={handleKeyPress}
      />
      <button onClick={handleSearch} className={styles.searchButton}>
        검색
      </button>
      <select
        value={taskType}
        onChange={(e) =>
          handleTaskTypeChange(e.target.value as "" | "situational" | "formal")
        }
      >
        <option value="">모든 타입</option>
        <option value="situational">상황발화</option>
        <option value="formal">정형발화</option>
      </select>
    </div>
  );
};

export default RecordingTabSearchFilters;
