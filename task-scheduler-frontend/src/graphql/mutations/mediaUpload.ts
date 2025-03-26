import { gql } from '@apollo/client';

/**
 * Mutation để tải lên hình ảnh lên server
 */
export const uploadImageMutation = gql`
  mutation UploadImage($file: Upload!, $storageType: StorageType) {
    uploadImage(file: $file, storageType: $storageType) {
      id
      filename
      mimetype
      size
      url
      created_at
    }
  }
`;

/**
 * Mutation để xóa hình ảnh từ server
 */
export const deleteImageMutation = gql`
  mutation DeleteImage($imageId: ID!) {
    deleteImage(imageId: $imageId)
  }
`; 