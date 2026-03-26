'use client';

import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  totalItems: number;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  totalItems
}: PaginationProps) {
  // Tạo mảng các số trang hiển thị
  const getPageNumbers = () => {
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = startPage + maxPagesToShow - 1;
    
    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
  };
  
  if (totalPages <= 1) return null;
  
  return (
    <div className="flex flex-col md:flex-row items-center justify-between px-4 py-4 bg-white border-t">
      <div className="flex items-center mb-4 md:mb-0 text-sm text-slate-700">
        <span>
          Hiển thị <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> - 
          <span className="font-medium">{Math.min(currentPage * pageSize, totalItems)}</span> trong 
          <span className="font-medium ml-1">{totalItems}</span> công việc
        </span>
        
        <div className="ml-4">
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            className="rounded border-slate-300 text-sm p-1"
            aria-label="Số công việc mỗi trang"
            title="Số công việc mỗi trang"
          >
            <option value={10}>10 mỗi trang</option>
            <option value={20}>20 mỗi trang</option>
            <option value={50}>50 mỗi trang</option>
            <option value={100}>100 mỗi trang</option>
          </select>
        </div>
      </div>
      
      <div className="flex items-center space-x-1">
        {/* Nút về trang đầu tiên */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className={`px-2 py-1 border rounded-md text-sm ${
            currentPage === 1
              ? 'text-slate-400 border-slate-200 cursor-not-allowed'
              : 'text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
          title="Trang đầu tiên"
          aria-label="Trang đầu tiên"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      
        {/* Nút về trang trước */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`px-2 py-1 border rounded-md text-sm ${
            currentPage === 1
              ? 'text-slate-400 border-slate-200 cursor-not-allowed'
              : 'text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
          title="Trang trước"
          aria-label="Trang trước"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        {/* Các nút số trang */}
        {getPageNumbers().map(pageNum => (
          <button
            key={pageNum}
            onClick={() => onPageChange(pageNum)}
            className={`px-3 py-1 border rounded-md text-sm ${
              currentPage === pageNum
                ? 'bg-blue-600 text-white border-blue-600'
                : 'text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
            title={`Trang ${pageNum}`}
            aria-label={`Trang ${pageNum}`}
            aria-current={currentPage === pageNum ? 'page' : undefined}
          >
            {pageNum}
          </button>
        ))}
        
        {/* Nút đến trang sau */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`px-2 py-1 border rounded-md text-sm ${
            currentPage === totalPages
              ? 'text-slate-400 border-slate-200 cursor-not-allowed'
              : 'text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
          title="Trang sau"
          aria-label="Trang sau"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        
        {/* Nút đến trang cuối cùng */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className={`px-2 py-1 border rounded-md text-sm ${
            currentPage === totalPages
              ? 'text-slate-400 border-slate-200 cursor-not-allowed'
              : 'text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
          title="Trang cuối"
          aria-label="Trang cuối"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
} 