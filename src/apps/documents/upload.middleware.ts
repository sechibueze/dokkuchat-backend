import multer from 'multer';

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_FILES_PER_REQUEST = 5;

export const uploadDocuments = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_FILES_PER_REQUEST },
}).array('files', MAX_FILES_PER_REQUEST);
