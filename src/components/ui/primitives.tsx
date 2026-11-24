import React from 'react';
import { cn } from '../../lib/utils.ts';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => {
    const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary:
        'bg-[#0f766e] text-white hover:bg-[#115e59] shadow-xs disabled:bg-slate-300',
      secondary:
        'bg-slate-100 text-slate-900 hover:bg-slate-200 disabled:opacity-50',
      outline:
        'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50',
      ghost: 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
      destructive: 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50',
    };

    const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
      sm: 'h-9 px-3.5 text-xs font-medium rounded-lg',
      md: 'h-10 px-5 text-sm font-medium rounded-lg',
      lg: 'h-11 px-6 text-sm font-semibold rounded-xl',
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e] focus-visible:ring-offset-2 disabled:cursor-not-allowed cursor-pointer',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'bg-white border border-slate-200 rounded-xl',
        className
      )}
    >
      {children}
    </div>
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0f766e] focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 disabled:bg-slate-50 disabled:text-slate-500',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0f766e] focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 disabled:bg-slate-50',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-[#0f766e] focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20',
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';
