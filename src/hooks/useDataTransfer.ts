// src/hooks/useDataTransfer.ts
import { useState } from "react";

interface DocumentData {
  id: string;
  data: any;
  subcollections?: { [key: string]: DocumentData[] };
}

interface ExportParams {
  collectionName: string;
  limit?: number;
  includeSubcollections?: boolean; // 추가
  startDate?: string; // 추가
  endDate?: string; // 추가
}

interface ImportParams {
  collectionName: string;
  data: DocumentData[];
  overwrite?: boolean;

  applyCompletionLogic?: boolean; // 추가
  excludeUserName?: string; // 추가
}

interface ExportResult {
  success: boolean;
  message: string;
  data?: DocumentData[];
  documentCount?: number;
}

interface ImportResult {
  success: boolean;
  message: string;
  importedCount?: number;
  skippedCount?: number;
  importedDocuments?: string[];
}

interface UseDataTransferReturn {
  // Export 관련
  exportData: (params: ExportParams) => Promise<ExportResult>;
  isExporting: boolean;
  exportResult: ExportResult | null;
  exportedData: DocumentData[] | null;

  // Import 관련
  importData: (params: ImportParams) => Promise<ImportResult>;
  isImporting: boolean;
  importResult: ImportResult | null;

  // 공통
  error: string | null;
  reset: () => void;

  loadFromFile: (file: File) => Promise<DocumentData[]>;
  uploadedData: DocumentData[] | null;
}

export const useDataTransfer = (): UseDataTransferReturn => {
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [exportedData, setExportedData] = useState<DocumentData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedData, setUploadedData] = useState<DocumentData[] | null>(null);

  const exportData = async (params: ExportParams): Promise<ExportResult> => {
    const {
      collectionName,
      limit = 100,
      includeSubcollections = false, // 추가
      startDate, // 추가
      endDate, // 추가
    } = params;

    if (!collectionName.trim()) {
      const errorResult = {
        success: false,
        message: "컬렉션 이름을 입력해주세요.",
      };
      setExportResult(errorResult);
      setError(errorResult.message);
      return errorResult;
    }

    setIsExporting(true);
    setExportResult(null);
    setError(null);
    setExportedData(null);

    try {
      const response = await fetch("/api/test/export-collection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          collectionName: collectionName.trim(),
          limit,
          includeSubcollections, // 추가
          startDate, // 추가
          endDate, // 추가
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const successResult = {
          success: true,
          message: data.message || "데이터를 성공적으로 Export했습니다!",
          data: data.data || [],
          documentCount: data.documentCount || 0,
        };
        setExportResult(successResult);
        setExportedData(data.data || []);
        return successResult;
      } else {
        const errorResult = {
          success: false,
          message: data.error || "Export 중 오류가 발생했습니다.",
        };
        setExportResult(errorResult);
        setError(errorResult.message);
        return errorResult;
      }
    } catch (err: any) {
      const errorResult = {
        success: false,
        message: `네트워크 오류: ${err.message}`,
      };
      setExportResult(errorResult);
      setError(errorResult.message);
      return errorResult;
    } finally {
      setIsExporting(false);
    }
  };

  const importData = async (params: ImportParams): Promise<ImportResult> => {
    const {
      collectionName,
      data,
      overwrite = true,
      applyCompletionLogic = false,
      excludeUserName = "",
    } = params;

    // 기본 유효성 검사
    if (!collectionName.trim()) {
      const errorResult = {
        success: false,
        message: "컬렉션 이름을 입력해주세요.",
      };
      setImportResult(errorResult);
      setError(errorResult.message);
      return errorResult;
    }

    if (!data || data.length === 0) {
      const errorResult = {
        success: false,
        message: "Import할 데이터가 없습니다. 먼저 Export를 실행해주세요.",
      };
      setImportResult(errorResult);
      setError(errorResult.message);
      return errorResult;
    }

    setIsImporting(true);
    setImportResult(null);
    setError(null);

    try {
      // 데이터 크기에 따라 처리 방식 결정
      if (data.length > 1000) {
        // 큰 데이터는 스트리밍 방식 사용
        return await handleStreamingImport({
          collectionName: collectionName.trim(),
          data,
          overwrite,
          applyCompletionLogic,
          excludeUserName,
        });
      } else {
        // 작은 데이터는 기존 방식 사용
        return await handleBatchImport({
          collectionName: collectionName.trim(),
          data,
          overwrite,
          applyCompletionLogic,
          excludeUserName,
        });
      }
    } catch (err: any) {
      const errorResult = {
        success: false,
        message: `네트워크 오류: ${err.message}`,
      };
      setImportResult(errorResult);
      setError(errorResult.message);
      return errorResult;
    } finally {
      setIsImporting(false);
    }
  };

  // 기존 배치 처리 방식
  async function handleBatchImport(params: {
    collectionName: string;
    data: DocumentData[];
    overwrite: boolean;
    applyCompletionLogic: boolean;
    excludeUserName: string;
  }): Promise<ImportResult> {
    const response = await fetch("/api/test/import-collection", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        collectionName: params.collectionName,
        data: params.data,
        overwrite: params.overwrite,
        applyCompletionLogic: params.applyCompletionLogic,
        excludeUserName: params.excludeUserName,
        useStreaming: false, // 기존 방식
      }),
    });

    const responseData = await response.json();

    if (response.ok) {
      const successResult = {
        success: true,
        message: responseData.message || "데이터를 성공적으로 Import했습니다!",
        importedCount: responseData.importedCount,
        skippedCount: responseData.skippedCount,
        importedDocuments: responseData.importedDocuments,
      };
      setImportResult(successResult);
      return successResult;
    } else {
      const errorResult = {
        success: false,
        message: responseData.error || "Import 중 오류가 발생했습니다.",
      };
      setImportResult(errorResult);
      setError(errorResult.message);
      return errorResult;
    }
  }

  // 새로운 스트리밍 처리 방식
  async function handleStreamingImport(params: {
    collectionName: string;
    data: DocumentData[];
    overwrite: boolean;
    applyCompletionLogic: boolean;
    excludeUserName: string;
  }): Promise<ImportResult> {
    console.log(`큰 데이터 감지 (${params.data.length}개), 청크 단위 처리`);

    const CHUNK_SIZE = 100; // 100개씩 나누어 처리
    let totalImported = 0;
    let totalSkipped = 0;

    // 데이터를 청크로 나누기
    for (let i = 0; i < params.data.length; i += CHUNK_SIZE) {
      const chunk = params.data.slice(i, i + CHUNK_SIZE);

      console.log(
        `청크 ${Math.floor(i / CHUNK_SIZE) + 1} 처리 중... (${i + 1}-${Math.min(
          i + CHUNK_SIZE,
          params.data.length
        )})`
      );

      try {
        // 각 청크를 별도 요청으로 전송
        const response = await fetch("/api/test/import-collection", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            collectionName: params.collectionName,
            data: chunk, // 청크 데이터만 전송
            overwrite: params.overwrite,
            applyCompletionLogic: params.applyCompletionLogic,
            excludeUserName: params.excludeUserName,
            useStreaming: false, // 청크는 일반 방식으로
          }),
        });

        const responseData = await response.json();

        if (response.ok) {
          totalImported += responseData.importedCount || 0;
          totalSkipped += responseData.skippedCount || 0;
        } else {
          throw new Error(responseData.error || "청크 처리 실패");
        }
      } catch (chunkError) {
        console.error(
          `청크 ${Math.floor(i / CHUNK_SIZE) + 1} 처리 실패:`,
          chunkError
        );
        // 실패한 청크의 데이터는 스킵으로 처리
        totalSkipped += chunk.length;
      }
    }

    const successResult = {
      success: true,
      message: `청크 처리로 ${totalImported}개 문서를 Import했습니다. (스킵: ${totalSkipped}개)`,
      importedCount: totalImported,
      skippedCount: totalSkipped,
    };

    setImportResult(successResult);
    return successResult;
  }

  const loadFromFile = (file: File): Promise<DocumentData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          setUploadedData(data);
          resolve(data);
        } catch (error) {
          reject(new Error("JSON 파일 파싱 실패"));
        }
      };
      reader.readAsText(file);
    });
  };

  const reset = () => {
    setExportResult(null);
    setImportResult(null);
    setExportedData(null);
    setError(null);
    setIsExporting(false);
    setIsImporting(false);
    setUploadedData(null);
  };

  return {
    exportData,
    isExporting,
    exportResult,
    exportedData,
    importData,
    isImporting,
    importResult,
    error,
    reset,
    loadFromFile,
    uploadedData,
  };
};
