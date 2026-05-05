import { S3Client } from "@aws-sdk/client-s3";
import multer, { StorageEngine } from "multer";
import multerS3 from "multer-s3";
import { serverConfig } from "./index";

let _upload: multer.Multer | null = null;

export const getUpload = (): multer.Multer => {
  if (!_upload) {
    const s3 = new S3Client({
      region: serverConfig.AWS_REGION,
      credentials: {
        accessKeyId: serverConfig.AWS_ACCESS_KEY_ID,
        secretAccessKey: serverConfig.AWS_SECRET_ACCESS_KEY,
      },
    });

    _upload = multer({
      storage: multerS3({
        s3,
        bucket: serverConfig.AWS_BUCKET,
        metadata: (_req, file, cb) => cb(null, { fieldName: file.fieldname }),
        key: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
      }) as StorageEngine,
    });
  }
  return _upload;
};
