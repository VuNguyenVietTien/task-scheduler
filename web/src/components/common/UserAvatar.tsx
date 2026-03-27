'use client';

interface UserAvatarProps {
  username: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg';
}

const getAvatarColor = (username: string) => {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500'
  ];
  const index = username.charCodeAt(0) % colors.length;
  return colors[index];
};

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base'
};

export function UserAvatar({ username, avatarUrl, size = 'md' }: UserAvatarProps) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={username}
        className={`${sizeClasses[size]} rounded-full ring-2 ring-white object-cover`}
      />
    );
  }

  return (
    <div 
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white ${getAvatarColor(username)}`}
      title={username}
    >
      {username.charAt(0).toUpperCase()}
    </div>
  );
}