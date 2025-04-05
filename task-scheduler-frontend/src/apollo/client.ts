import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { typeDefs } from '../graphql/schema';

// Cache cho token
let cachedToken: string | null = null;
let tokenExpiryTime: number | null = null;
let tokenFetchPromise: Promise<string | null> | null = null;

// Thời gian token hết hạn tính bằng mili giây (10 phút)
const TOKEN_EXPIRY_TIME = 10 * 60 * 1000;

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/graphql` : 'http://localhost:8080/graphql',
});

// Hàm lấy token với cơ chế cache để tránh gọi liên tục
const getAuthToken = async (): Promise<string | null> => {
  const now = Date.now();
  
  // Nếu token đã được cache và còn hiệu lực, sử dụng token đó
  if (cachedToken && tokenExpiryTime && now < tokenExpiryTime) {
    return cachedToken;
  }
  
  // Nếu đang có request đang fetch token, đợi kết quả từ promise đó
  if (tokenFetchPromise) {
    return tokenFetchPromise;
  }
  
  // Tạo promise mới để fetch token
  tokenFetchPromise = (async () => {
    try {
      const response = await fetch('/api/auth/get-token');
      
      // Reset promise sau khi hoàn thành
      tokenFetchPromise = null;
      
      if (!response.ok) {
        console.error('Failed to get token:', response.statusText);
        return null;
      }
      
      const data = await response.json();
      if (!data.token) {
        console.error('No token in response');
        return null;
      }
      
      // Cập nhật cache
      cachedToken = data.token;
      tokenExpiryTime = now + TOKEN_EXPIRY_TIME;
      
      return data.token;
    } catch (error) {
      console.error('Error fetching token:', error);
      // Reset promise khi có lỗi
      tokenFetchPromise = null;
      return null;
    }
  })();
  
  return tokenFetchPromise;
};

const authLink = setContext(async (_, { headers }) => {
  const token = await getAuthToken();
  
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

export const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
  typeDefs,
}); 