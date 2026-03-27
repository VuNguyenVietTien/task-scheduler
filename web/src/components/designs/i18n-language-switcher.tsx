interface Props {
  locale: string;
  onChange: (locale: 'en' | 'vi' | 'ja') => void;
}

export default function I18nLanguageSwitcher({ locale, onChange }: Props) {
  return (
    <select
      value={locale}
      onChange={e => onChange(e.target.value as 'en' | 'vi' | 'ja')}
      className="px-2 py-1 border rounded text-sm"
    >
      <option value="en">EN</option>
      <option value="vi">VI</option>
      <option value="ja">JA</option>
    </select>
  );
}
