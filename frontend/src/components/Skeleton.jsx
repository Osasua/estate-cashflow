export default function Skeleton({ width = '100%', height = '20px', className = '' }) {
  return <div className={`skeleton shimmer ${className}`} style={{ width, height }} />;
}