import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Sửa lại kiểu dữ liệu để tương thích với formidable
import type { File } from 'formidable';

// Định nghĩa kiểu dữ liệu response
type ResponseData = {
  url?: string;
  error?: string;
  success: boolean;
};

// Tắt bodyParser để xử lý formData
export const config = {
  api: {
    bodyParser: false,
  },
};

// Đường dẫn lưu trữ hình ảnh local
const UPLOAD_DIR = process.env.UPLOAD_DIR || './public/media/uploads';
const MEDIA_BASE_URL = process.env.NEXT_PUBLIC_MEDIA_BASE_PATH || '/media/uploads';

// Thiết lập Google Drive API (nếu dùng)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// Tạo thư mục upload nếu chưa tồn tại
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (error) {
  console.error('Không thể tạo thư mục upload:', error);
}

// Hàm helper lấy phần mở rộng từ MIME type
function getExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  };
  return map[mimeType] || 'bin';
}

// Hàm upload file lên Google Drive
async function uploadToGoogleDrive(file: File): Promise<string> {
  try {
    // Kiểm tra các thông tin cần thiết
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN || !GOOGLE_DRIVE_FOLDER_ID) {
      throw new Error('Thiếu thông tin cấu hình Google Drive');
    }

    // 1. Lấy access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: GOOGLE_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Không thể lấy token: ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error('Không nhận được access token');
    }

    // 2. Tải file lên Google Drive
    const fileContent = fs.readFileSync(file.filepath);
    const fileName = `${uuidv4()}-${file.originalFilename?.replace(/[^a-zA-Z0-9-_.]/g, '_') || 'image'}`;
    const mimeType = file.mimetype || 'application/octet-stream';

    // Tạo multipart/related request
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    // Tạo metadata cho file
    const metadata = {
      name: fileName,
      mimeType: mimeType,
      parents: [GOOGLE_DRIVE_FOLDER_ID]
    };

    // Tạo body cho request
    let requestBody = '';
    requestBody += delimiter;
    requestBody += 'Content-Type: application/json\r\n\r\n';
    requestBody += JSON.stringify(metadata);
    requestBody += delimiter;
    requestBody += `Content-Type: ${mimeType}\r\n`;
    requestBody += 'Content-Transfer-Encoding: base64\r\n\r\n';
    
    // Convert file content to base64 string
    const base64Data = Buffer.from(fileContent).toString('base64');
    
    // Upload to Google Drive
    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webContentLink,webViewLink', 
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: Buffer.concat([
          Buffer.from(requestBody, 'utf8'),
          Buffer.from(base64Data, 'utf8'),
          Buffer.from(closeDelimiter, 'utf8')
        ])
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Drive API error: ${errorText}`);
    }

    const data = await response.json();
    
    // Chia sẻ file công khai để có thể xem
    await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });

    // Trả về URL truy cập công khai
    return `https://drive.google.com/uc?export=view&id=${data.id}`;
  } catch (error) {
    console.error('Lỗi khi upload lên Google Drive:', error);
    throw error;
  }
}

// Hàm upload file lưu trữ local
async function uploadToLocalStorage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Tạo tên file duy nhất
      const ext = getExtensionFromMimeType(file.mimetype || 'application/octet-stream');
      const fileName = `${uuidv4()}.${ext}`;
      
      // Đường dẫn đầy đủ để lưu file
      const imagePath = path.join(UPLOAD_DIR, fileName);
      
      // Sao chép file từ vị trí tạm sang thư mục đích
      const readStream = fs.createReadStream(file.filepath);
      const writeStream = fs.createWriteStream(imagePath);
      
      readStream.on('error', reject);
      writeStream.on('error', reject);
      
      writeStream.on('finish', () => {
        // Tạo URL tương đối để truy cập file
        const fileUrl = `${MEDIA_BASE_URL}/${fileName}`;
        resolve(fileUrl);
      });
      
      // Thực hiện sao chép
      readStream.pipe(writeStream);
    } catch (error) {
      reject(error);
    }
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Chỉ chấp nhận phương thức POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // Xử lý multipart form data
  const form = new formidable.IncomingForm({
    keepExtensions: true
  });
  
  try {
    const { fields, files } = await new Promise<{
      fields: formidable.Fields;
      files: formidable.Files;
    }>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });
    
    // Kiểm tra file đã được upload
    if (!files.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    // Lấy file từ files object
    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;
    
    // Kiểm tra loại file
    if (!uploadedFile.mimetype?.startsWith('image/')) {
      return res.status(400).json({ success: false, error: 'Only image files are allowed' });
    }
    
    // Kiểm tra kích thước file
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (uploadedFile.size > MAX_FILE_SIZE) {
      return res.status(400).json({ success: false, error: 'File size exceeds limit (5MB)' });
    }
    
    // Xác định storage type
    const storageTypeValue = fields.storage_type;
    const storageType = Array.isArray(storageTypeValue) ? storageTypeValue[0] : (storageTypeValue || 'local');
    
    // Upload file theo loại storage
    let fileUrl = '';
    if (storageType === 'google_drive') {
      fileUrl = await uploadToGoogleDrive(uploadedFile);
    } else {
      fileUrl = await uploadToLocalStorage(uploadedFile);
    }
    
    // Xóa file tạm sau khi xử lý xong
    fs.unlink(uploadedFile.filepath, (err) => {
      if (err) console.error('Không thể xóa file tạm:', err);
    });
    
    // Trả về URL của file đã upload
    return res.status(200).json({
      success: true,
      url: fileUrl
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      error: 'Lỗi khi tải lên hình ảnh'
    });
  }
} 