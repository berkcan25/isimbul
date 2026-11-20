export default function BrandWordmark({ size = 'md' }) {
  const isLg = size === 'lg';
  return (
    <span
      className={`inline-flex items-baseline font-editorial font-semibold tracking-tight select-none text-[#161513] dark:text-[#F2EDE4] ${
        isLg ? 'text-3xl' : 'text-2xl'
      }`}
    >
      <span className="relative inline-block">
        I
        <span
          aria-hidden="true"
          className="absolute left-1/2 -translate-x-1/2 bg-[#B84A32] dark:bg-[#D1634B]"
          style={{
            top: isLg ? '0.04em' : '0.05em',
            width: isLg ? '5px' : '4px',
            height: isLg ? '5px' : '4px',
          }}
        />
      </span>
      <span>simBul</span>
    </span>
  );
}