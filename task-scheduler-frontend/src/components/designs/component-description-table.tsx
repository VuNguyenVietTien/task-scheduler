'use client';
import { useRef, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { UPDATE_COMPONENT } from '@/graphql/mutations/designs';

interface Props {
  components: any[];
  selectedComponentId: string | null;
  onRowClick: (id: string) => void;
  locale: 'en' | 'vi' | 'ja';
  onRefresh: () => void;
}

function sortByCustomId(components: any[]): any[] {
  return [...components].sort((a, b) => {
    const partsA = a.customId.split('.').map(Number);
    const partsB = b.customId.split('.').map(Number);
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const diff = (partsA[i] || 0) - (partsB[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });
}

export default function ComponentDescriptionTable({
  components,
  selectedComponentId,
  onRowClick,
  locale,
  onRefresh,
}: Props) {
  const [updateComponent] = useMutation(UPDATE_COMPONENT);
  const selectedRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedComponentId]);

  const handleInlineEdit = async (id: string, field: string, value: string) => {
    const input: Record<string, string> = { id };
    if (field === 'name') input.name = value;
    if (field === 'dataType') input.dataType = value;
    if (field === 'displayLogic') input.displayLogic = value;
    await updateComponent({ variables: { input } });
    onRefresh();
  };

  const sorted = sortByCustomId(components);

  return (
    <div className="text-sm">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50 sticky top-0">
            <th className="p-2 text-left border-b font-medium">ID</th>
            <th className="p-2 text-left border-b font-medium">Name</th>
            <th className="p-2 text-left border-b font-medium">Type</th>
            <th className="p-2 text-left border-b font-medium">DB Field</th>
            <th className="p-2 text-left border-b font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(comp => {
            const isSelected = comp.id === selectedComponentId;
            const desc = comp.descriptions?.[locale] || comp.descriptions?.en || '';
            const fieldMap = comp.fieldMappings?.[0];
            return (
              <tr
                key={comp.id}
                ref={isSelected ? selectedRef : undefined}
                onClick={() => onRowClick(comp.id)}
                className={`cursor-pointer border-b transition-colors ${
                  isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                }`}
              >
                <td className="p-2 font-mono text-xs">{comp.customId}</td>
                <td className="p-2">
                  <input
                    defaultValue={comp.name}
                    onBlur={e => {
                      if (e.target.value !== comp.name) {
                        handleInlineEdit(comp.id, 'name', e.target.value);
                      }
                    }}
                    className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none px-1"
                    onClick={e => e.stopPropagation()}
                  />
                </td>
                <td className="p-2 text-gray-500">{comp.dataType || '-'}</td>
                <td className="p-2 text-xs text-gray-500 font-mono">
                  {fieldMap ? `${fieldMap.dbTable}.${fieldMap.dbColumn}` : '-'}
                </td>
                <td className="p-2 text-gray-600">{desc || '-'}</td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={5} className="p-4 text-center text-gray-400">
                No components mapped. Click on SVG elements to create components.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
