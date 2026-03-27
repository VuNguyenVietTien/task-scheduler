import { NextApiRequest, NextApiResponse } from 'next';
import * as formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { getToken } from 'next-auth/jwt';

// Vô hiệu hóa body parser mặc định để xử lý form-data
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Phương thức không được hỗ trợ' });
  }

  try {
    // Xác thực người dùng (nếu cần)
    const token = await getToken({ req });
    if (!token) {
      return res.status(401).json({ error: 'Không được phép' });
    }

    // Phân tích form-data
    const form = formidable.formidable({
      uploadDir: path.join(process.cwd(), 'public/uploads'),
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      filename: (_name: string, _ext: string, _part: formidable.Part, _form: any) => {
        const uniqueId = uuid();
        return `${uniqueId}${_ext}`;
      },
    });

    // Tạo thư mục upload nếu chưa tồn tại
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Phân tích request
    const [fields, files] = await new Promise<[formidable.Fields<string>, formidable.Files<string>]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    // Lấy file đã upload
    const uploadedFile = files.file?.[0];
    if (!uploadedFile) {
      return res.status(400).json({ error: 'Không tìm thấy file' });
    }

    // Tạo URL trả về
    const fileName = path.basename(uploadedFile.filepath);
    const url = `/uploads/${fileName}`;

    // Trả về thông tin file
    return res.status(200).json({
      id: fileName.split('.')[0],
      filename: uploadedFile.originalFilename || fileName,
      mimetype: uploadedFile.mimetype || 'application/octet-stream',
      size: uploadedFile.size,
      url,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Lỗi khi xử lý upload:', error);
    return res.status(500).json({ error: 'Lỗi server khi xử lý upload' });
  }
} 