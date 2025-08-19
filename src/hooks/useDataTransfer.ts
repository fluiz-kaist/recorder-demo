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
}

interface ImportParams {
  collectionName: string;
  data: DocumentData[];
  overwrite?: boolean;
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
    const { collectionName, limit = 100 } = params;

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
    const { collectionName, data, overwrite = true } = params;

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
      const response = await fetch("/api/test/import-collection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          collectionName: collectionName.trim(),
          data,
          overwrite,
        }),
      });

      const responseData = await response.json();

      if (response.ok) {
        const successResult = {
          success: true,
          message:
            responseData.message || "데이터를 성공적으로 Import했습니다!",
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
