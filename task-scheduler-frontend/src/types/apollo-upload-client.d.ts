declare module 'apollo-upload-client' {
  import { HttpOptions } from '@apollo/client';
  import { ApolloLink } from '@apollo/client';

  export interface UploadOptions extends HttpOptions {
    credentials?: string;
    headers?: Record<string, string>;
  }

  export function createUploadLink(options?: UploadOptions): ApolloLink;
}

declare module 'apollo-upload-client/createUploadLink.mjs' {
  import { ApolloLink } from '@apollo/client';
  import { HttpOptions } from '@apollo/client';

  export interface UploadOptions extends HttpOptions {
    credentials?: string;
    headers?: Record<string, string>;
  }

  export default function createUploadLink(options?: UploadOptions): ApolloLink;
} 