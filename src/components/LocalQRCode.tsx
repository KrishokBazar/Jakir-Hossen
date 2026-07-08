import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

interface LocalQRCodeProps {
  text: string;
  className?: string;
}

export function LocalQRCode({ text, className }: LocalQRCodeProps) {
  const [qrSrc, setQrSrc] = useState<string>('');

  useEffect(() => {
    if (!text) return;
    QRCode.toDataURL(text, {
      margin: 1,
      width: 150,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => {
        setQrSrc(url);
      })
      .catch((err) => {
        console.error('Error generating local QR code:', err);
      });
  }, [text]);

  if (!qrSrc) {
    return (
      <div 
        className={`animate-pulse bg-slate-100 border border-slate-200 rounded-md ${className}`} 
        style={{ width: '64px', height: '64px' }}
      />
    );
  }

  return (
    <img 
      src={qrSrc} 
      alt="Verification QR Code" 
      className={className} 
    />
  );
}
