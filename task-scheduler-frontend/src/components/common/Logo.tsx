import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  width = 40,
  height = 40
}) => {
  return (
    <Link href="/" className={className}>
      <Image
        src="/logo.png"
        alt="Logo"
        width={width}
        height={height}
        priority
      />
    </Link>
  );
}; 