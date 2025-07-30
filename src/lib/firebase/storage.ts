// src/lib/firebase/storage.ts - Firebase Storage 관련 유틸
import { storage } from "./config";

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  getMetadata,
  listAll,
  UploadResult,
  FullMetadata,
  // 기타 필요한 함수들
} from "firebase/storage"; // ✅ 여기서 가져와야 함

// 파일 업로드 옵션 타입
interface UploadOptions {
  folder?: string;
  fileName?: string;
  metadata?: { [key: string]: string };
}

// 파일 정보 타입
interface FileInfo {
  name: string;
  fullPath: string;
  downloadURL: string;
  size: number;
  contentType: string;
  timeCreated: string;
  updated: string;
}

// 🔹 파일 업로드 (File 객체)
export async function uploadFile(
  file: File,
  options: UploadOptions = {}
): Promise<{ downloadURL: string; filePath: string }> {
  try {
    const { folder = "", fileName, metadata } = options;

    // 파일명 생성 (제공되지 않으면 타임스탬프 + 원본 파일명)
    const finalFileName = fileName || `${Date.now()}_${file.name}`;
    const filePath = folder ? `${folder}/${finalFileName}` : finalFileName;

    const storageRef = ref(storage, filePath);

    // 메타데이터 설정
    const uploadMetadata = {
      contentType: file.type,
      customMetadata: metadata,
    };

    const uploadResult: UploadResult = await uploadBytes(
      storageRef,
      file,
      uploadMetadata
    );
    const downloadURL = await getDownloadURL(uploadResult.ref);

    console.log(`✅ 파일 업로드 완료: ${filePath}`);
    return { downloadURL, filePath };
  } catch (err) {
    console.error("❌ 파일 업로드 실패:", err);
    throw err;
  }
}

// 🔹 파일 업로드 (Blob 또는 Uint8Array)
export async function uploadBlob(
  data: Blob | Uint8Array,
  filePath: string,
  contentType?: string
): Promise<{ downloadURL: string; filePath: string }> {
  try {
    const storageRef = ref(storage, filePath);

    const uploadMetadata = contentType ? { contentType } : undefined;
    const uploadResult: UploadResult = await uploadBytes(
      storageRef,
      data,
      uploadMetadata
    );
    const downloadURL = await getDownloadURL(uploadResult.ref);

    console.log(`✅ 블롭 업로드 완료: ${filePath}`);
    return { downloadURL, filePath };
  } catch (err) {
    console.error("❌ 블롭 업로드 실패:", err);
    throw err;
  }
}

// 🔹 다운로드 URL 가져오기
export async function getFileDownloadURL(filePath: string): Promise<string> {
  try {
    const storageRef = ref(storage, filePath);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (err) {
    console.error("❌ 다운로드 URL 가져오기 실패:", err);
    throw err;
  }
}

// 🔹 파일 삭제
export async function deleteFile(filePath: string): Promise<void> {
  try {
    const storageRef = ref(storage, filePath);
    await deleteObject(storageRef);
    console.log(`🗑️ 파일 삭제됨: ${filePath}`);
  } catch (err) {
    console.error("❌ 파일 삭제 실패:", err);
    throw err;
  }
}

// 🔹 파일 메타데이터 가져오기
export async function getFileMetadata(filePath: string): Promise<FullMetadata> {
  try {
    const storageRef = ref(storage, filePath);
    const metadata = await getMetadata(storageRef);
    return metadata;
  } catch (err) {
    console.error("❌ 메타데이터 가져오기 실패:", err);
    throw err;
  }
}

// 🔹 파일 정보 가져오기 (메타데이터 + 다운로드 URL)
export async function getFileInfo(filePath: string): Promise<FileInfo> {
  try {
    const [metadata, downloadURL] = await Promise.all([
      getFileMetadata(filePath),
      getFileDownloadURL(filePath),
    ]);

    return {
      name: metadata.name,
      fullPath: metadata.fullPath,
      downloadURL,
      size: metadata.size,
      contentType: metadata.contentType || "",
      timeCreated: metadata.timeCreated,
      updated: metadata.updated,
    };
  } catch (err) {
    console.error("❌ 파일 정보 가져오기 실패:", err);
    throw err;
  }
}

// 🔹 폴더 내 모든 파일 목록 가져오기
export async function listFiles(folderPath: string = ""): Promise<FileInfo[]> {
  try {
    const storageRef = ref(storage, folderPath);
    const listResult = await listAll(storageRef);

    const filePromises = listResult.items.map(async (itemRef) => {
      const [metadata, downloadURL] = await Promise.all([
        getMetadata(itemRef),
        getDownloadURL(itemRef),
      ]);

      return {
        name: metadata.name,
        fullPath: metadata.fullPath,
        downloadURL,
        size: metadata.size,
        contentType: metadata.contentType || "",
        timeCreated: metadata.timeCreated,
        updated: metadata.updated,
      };
    });

    const files = await Promise.all(filePromises);
    console.log(
      `📁 ${folderPath || "루트"} 폴더에서 ${files.length}개 파일 찾음`
    );
    return files;
  } catch (err) {
    console.error("❌ 파일 목록 가져오기 실패:", err);
    throw err;
  }
}

// 🔹 이미지 업로드 (리사이징 옵션 포함)
export async function uploadImage(
  file: File,
  options: UploadOptions & { maxWidth?: number; quality?: number } = {}
): Promise<{ downloadURL: string; filePath: string }> {
  try {
    // 이미지 파일 검증
    if (!file.type.startsWith("image/")) {
      throw new Error("이미지 파일만 업로드 가능합니다.");
    }

    let processedFile = file;

    // 이미지 리사이징 (선택사항)
    if (options.maxWidth || options.quality) {
      processedFile = await resizeImage(
        file,
        options.maxWidth,
        options.quality
      );
    }

    return await uploadFile(processedFile, options);
  } catch (err) {
    console.error("❌ 이미지 업로드 실패:", err);
    throw err;
  }
}

// 🔹 이미지 리사이징 헬퍼 함수
async function resizeImage(
  file: File,
  maxWidth?: number,
  quality: number = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      // 리사이징 계산
      let { width, height } = img;

      if (maxWidth && width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      // 이미지 그리기
      ctx?.drawImage(img, 0, 0, width, height);

      // Blob으로 변환
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const resizedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });
            resolve(resizedFile);
          } else {
            reject(new Error("이미지 리사이징 실패"));
          }
        },
        file.type,
        quality
      );
    };

    img.onerror = () => reject(new Error("이미지 로드 실패"));
    img.src = URL.createObjectURL(file);
  });
}
