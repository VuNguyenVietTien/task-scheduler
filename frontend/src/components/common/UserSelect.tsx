import React, { useState } from 'react';
import { Combobox } from '@headlessui/react';
import { UserAvatar } from './UserAvatar';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
  photoURL?: string | null;
}

interface UserSelectProps {
  users: User[];
  selectedUser: User | null;
  onSelect: (user: User) => void;
  placeholder?: string;
  className?: string;
}

export const UserSelect: React.FC<UserSelectProps> = ({
  users,
  selectedUser,
  onSelect,
  placeholder = 'Chọn người dùng...',
  className = ''
}) => {
  const [query, setQuery] = useState('');

  const filteredUsers = query === ''
    ? users
    : users.filter((user) => {
        const searchStr = `${user.name} ${user.email}`.toLowerCase();
        return searchStr.includes(query.toLowerCase());
      });

  return (
    <Combobox value={selectedUser} onChange={onSelect}>
      <div className={cn('relative', className)}>
        <Combobox.Input
          className="w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          onChange={(event) => setQuery(event.target.value)}
          displayValue={(user: User | null) => user?.name || ''}
          placeholder={placeholder}
        />
        <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
          <svg
            className="h-5 w-5 text-gray-400"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
          >
            <path
              d="M7 7l3-3 3 3m0 6l-3 3-3-3"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Combobox.Button>

        <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
          {filteredUsers.length === 0 && query !== '' ? (
            <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
              Không tìm thấy người dùng.
            </div>
          ) : (
            filteredUsers.map((user) => (
              <Combobox.Option
                key={user.id}
                value={user}
                className={({ active }) =>
                  cn(
                    'relative cursor-default select-none py-2 pl-3 pr-9',
                    active ? 'bg-indigo-600 text-white' : 'text-gray-900'
                  )
                }
              >
                {({ active, selected }) => (
                  <div className="flex items-center">
                    <UserAvatar
                      src={user.photoURL}
                      alt={user.name}
                      size="sm"
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className={cn(
                        'text-sm',
                        active ? 'text-indigo-200' : 'text-gray-500'
                      )}>
                        {user.email}
                      </div>
                    </div>
                    {selected && (
                      <span
                        className={cn(
                          'absolute inset-y-0 right-0 flex items-center pr-4',
                          active ? 'text-white' : 'text-indigo-600'
                        )}
                      >
                        <svg
                          className="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    )}
                  </div>
                )}
              </Combobox.Option>
            ))
          )}
        </Combobox.Options>
      </div>
    </Combobox>
  );
}; 