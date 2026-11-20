import { useTranslation } from '../context/LanguageContext';
import { ArrowUpRight } from 'lucide-react';

export default function About() {
  const { t } = useTranslation();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-16 space-y-12 animate-fade-in">
      <header className="border-b border-[#161513] dark:border-[#443F37] pb-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#B84A32] dark:text-[#DF735B]">
          {t.atlasKicker}
        </p>
        <h1 className="font-editorial text-4xl sm:text-6xl font-medium mt-2 leading-tight">
          {t.aboutTitle}
        </h1>
        <p className="font-editorial text-xl text-[#57524A] dark:text-[#A8A095] mt-3 leading-relaxed">
          {t.aboutDesc}
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-[#B84A32] dark:text-[#DF735B]">
          {t.dataSources}
        </h2>
        <p className="text-base text-[#161513] dark:text-[#E5DFD5] leading-relaxed">
          {t.nisanyanCredit}
        </p>
        <div>
          <a
            href="https://www.nisanyanadlar.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] border-b border-[#161513] dark:border-[#F2EDE4] pb-1 hover:text-[#B84A32] hover:border-[#B84A32] transition-colors"
          >
            <span>{t.visitNisanyan}</span>
            <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-[#D8D1C5] dark:border-[#332F29] pt-8">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-[#878075] mb-2">
            {t.disclaimer}
          </h3>
          <p className="text-sm text-[#57524A] dark:text-[#A8A095] leading-relaxed">
            {t.disclaimerText}
          </p>
        </div>

        <div>
          <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-[#878075] mb-2">
            {t.contact}
          </h3>
          <a
            href="mailto:contact@isimbul.com"
            className="text-sm text-[#161513] dark:text-[#F2EDE4] border-b border-[#D8D1C5] hover:border-[#B84A32] hover:text-[#B84A32] pb-0.5 transition-colors"
          >
            contact@isimbul.com
          </a>
        </div>
      </section>
    </div>
  );
}
