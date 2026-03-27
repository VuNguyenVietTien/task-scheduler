import { gql } from '@apollo/client';

/**
 * Mutation để tải lên hình ảnh lên server
 */
export const uploadImageMutation = gql`
  mutation UploadImage($input: MediaUploadInput!) {
    uploadImage(input: $input) {
      id
      filename
      mimetype
      size
      url
      createdAt
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