import React, { ChangeEvent, useEffect, useState } from 'react';
import { Input } from '@/components/common/Input';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchInputProps {
  onSearch: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceTime?: number;
  defaultValue?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  onSearch,
  placeholder = 'Tìm kiếm...',
  className = '',
  debounceTime = 300,
  defaultValue = ''
}) => {
  const [searchTerm, setSearchTerm] = useState(defaultValue);
  const debouncedSearchTerm = useDebounce(searchTerm, debounceTime);

  useEffect(() => {
    onSearch(debouncedSearchTerm);
  }, [debouncedSearchTerm, onSearch]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  return (
    <Input
      type="text"
      placeholder={placeholder}
      value={searchTerm}
      onChange={handleChange}
      wrapperClassName={className}
    />
  );
}; 