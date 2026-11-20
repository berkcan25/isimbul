import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { normalizeSearch } from '../utils/nameHelpers';

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  label = '',
  allLabel,
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  const effectiveAllLabel = allLabel || t.all;

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) => {
    const labelToCheck = typeof opt === 'object' ? opt.label : opt;
    return normalizeSearch(labelToCheck).includes(normalizeSearch(search));
  });

  const getDisplayValue = () => {
    if (value === 'all') return effectiveAllLabel;
    const selectedOption = options.find((opt) =>
      typeof opt === 'object' ? opt.value === value : opt === value
    );
    return selectedOption
      ? typeof selectedOption === 'object'
        ? selectedOption.label
        : selectedOption
      : value;
  };

  return (
    <div className="w-full relative" ref={wrapperRef}>
      {label && (
        <label className="block text-[11px] font-medium text-[#57524A] dark:text-[#A8A095] uppercase tracking-[0.12em] mb-1.5">
          {label}
        </label>
      )}

      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-[42px] px-3 flex items-center justify-between bg-[#FAF7F1] dark:bg-[#1D1B18] border transition-colors cursor-pointer select-none ${
          isOpen
            ? 'border-[#161513] dark:border-[#F2EDE4] z-20 relative'
            : 'border-[#D8D1C5] dark:border-[#332F29] hover:border-[#161513] dark:hover:border-[#A8A095]'
        }`}
      >
        <span
          className={`block truncate text-xs font-medium uppercase tracking-[0.06em] mr-2 flex-1 min-w-0 ${
            value === 'all'
              ? 'text-[#57524A] dark:text-[#A8A095]'
              : 'text-[#161513] dark:text-[#F2EDE4]'
          }`}
        >
          {getDisplayValue()}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {value !== 'all' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('all');
              }}
              className="p-0.5 text-[#878075] hover:text-[#B84A32] transition-colors"
              aria-label="Clear filter"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-[#878075] transition-transform duration-150 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[#FAF7F1] dark:bg-[#1D1B18] border border-[#161513] dark:border-[#5C554B] overflow-hidden">
          <div className="p-2 border-b border-[#E2DBD0] dark:border-[#2C2823]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#878075]" />
              <input
                type="text"
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-transparent border border-[#D8D1C5] dark:border-[#332F29] focus:outline-none focus:border-[#161513] dark:focus:border-[#F2EDE4] text-[#161513] dark:text-[#F2EDE4] placeholder:text-[#878075]"
                placeholder={placeholder || t.searchBar}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <div className="max-h-[240px] overflow-y-auto divide-y divide-[#EAE4D8] dark:divide-[#26231F]">
            <div
              onClick={() => {
                onChange('all');
                setIsOpen(false);
              }}
              className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                value === 'all'
                  ? 'bg-[#B84A32]/10 text-[#B84A32] dark:text-[#DF735B] font-semibold'
                  : 'text-[#161513] dark:text-[#E5DFD5] hover:bg-[#EAE4D8]/60 dark:hover:bg-[#26231F]'
              }`}
            >
              <span>{effectiveAllLabel}</span>
              {value === 'all' && <Check className="w-3.5 h-3.5" />}
            </div>

            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const optValue = typeof opt === 'object' ? opt.value : opt;
                const optLabel = typeof opt === 'object' ? opt.label : opt;
                const isSelected = value === optValue;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      onChange(optValue);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-[#B84A32]/10 text-[#B84A32] dark:text-[#DF735B] font-semibold'
                        : 'text-[#161513] dark:text-[#E5DFD5] hover:bg-[#EAE4D8]/60 dark:hover:bg-[#26231F]'
                    }`}
                  >
                    <span className="truncate mr-2">{optLabel}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-[#878075] italic">
                {t.noCriteria}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}