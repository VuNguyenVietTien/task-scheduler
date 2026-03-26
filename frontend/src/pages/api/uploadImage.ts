import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

// Cấu hình formidable để xử lý upload file
export const config = {
  api: {
    bodyParser: false, // Disable bodyParser vì chúng ta xử lý form data
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('API uploadImage được gọi');
    
    // Lấy đường dẫn thư mục upload từ biến môi trường
    const uploadDir = process.env.MEDIA_UPLOAD_DIR || '/Users/TienVNV/Desktop/ProjectManager/media';
    
    console.log('Thư mục upload:', uploadDir);
    
    // Đảm bảo thư mục tồn tại
    if (!fs.existsSync(uploadDir)) {
      console.log('Thư mục không tồn tại, đang tạo mới:', uploadDir);
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Cấu hình form parser
    const form = new formidable.IncomingForm({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      filename: (name, ext, part, form) => {
        // Tạo tên file duy nhất với timestamp để tránh trùng lặp
        return `${Date.now()}-${name.replace(/[^a-zA-Z0-9]/g, '_')}${ext}`;
      }
    });

    // Xử lý upload
    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('Lỗi khi parse form:', err);
          reject(err);
          return;
        }
        resolve([fields, files]);
      });
    });

    console.log('Files nhận được:', Object.keys(files).length);
    
    // Lấy file từ kết quả
    const fileKey = Object.keys(files)[0];
    const file = files[fileKey];
    
    if (!file) {
      console.error('Không tìm thấy file trong request');
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // File có thể là một đối tượng hoặc một mảng
    const fileInfo = Array.isArray(file) ? file[0] : file;
    
    console.log('Thông tin file được upload:', {
      fileName: fileInfo.originalFilename,
      newFilepath: fileInfo.filepath,
      mimetype: fileInfo.mimetype,
      size: fileInfo.size
    });

    // formidable 4.x đã tự động lưu file vào uploadDir với tên duy nhất
    // Vì vậy, chúng ta chỉ cần lấy tên file từ đường dẫn
    const fileName = path.basename(fileInfo.filepath);
    
    // Tạo URL cho file đã upload
    const baseUrl = process.env.NEXT_PUBLIC_MEDIA_BASE_PATH || '/media';
    const fileUrl = `${baseUrl}/${fileName}`;
    
    console.log('URL file:', fileUrl);

    // Trả về URL cho client
    return res.status(200).json({ 
      url: fileUrl,
      width: 'auto',
      height: 'auto',
      success: true,
      message: 'File uploaded successfully' 
    });
  } catch (error) {
    console.error('Lỗi khi upload file:', error);
    return res.status(500).json({ 
      message: 'Error uploading file', 
      error: String(error),
      success: false
    });
  }
} 