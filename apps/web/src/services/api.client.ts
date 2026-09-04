import axios, { type AxiosInstance } from 'axios';
import { API_BASE_URL } from '@/config/constants';

const REQUEST_TIMEOUT_MS = 30_000;

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
});
