'use client';

import { Fragment } from 'react';
import { Dialog, Listbox, Transition } from '@headlessui/react';
import { Project } from '@/data/mockProjects';

const STATUS_OPTIONS = [
  { id: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
  { id: 'completed', label: 'Completed', color: 'bg-blue-100 text-blue-800' },
  { id: 'on-hold', label: 'On Hold', color: 'bg-yellow-100 text-yellow-800' }
] as const;

interface StatusUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (status: Project['status']) => void;
  currentStatus: Project['status'];
}

export function StatusUpdateModal({
  isOpen,
  onClose,
  onUpdate,
  currentStatus
}: StatusUpdateModalProps) {
  const selectedStatus = STATUS_OPTIONS.find(status => status.id === currentStatus);

  const handleUpdate = (newStatus: typeof STATUS_OPTIONS[number]) => {
    onUpdate(newStatus.id);
    onClose();
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="fixed inset-0 z-10 overflow-y-auto" onClose={onClose}>
        <div className="min-h-screen px-4 text-center">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
          </Transition.Child>

          {/* This element is to trick the browser into centering the modal contents. */}
          <span className="inline-block h-screen align-middle" aria-hidden="true">
            &#8203;
          </span>
          
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
              <Dialog.Title
                as="h3"
                className="text-lg font-medium leading-6 text-gray-900"
              >
                Update Project Status
              </Dialog.Title>
              
              <div className="mt-4">
                <Listbox value={selectedStatus} onChange={handleUpdate}>
                  <div className="relative mt-1">
                    <Listbox.Button className="relative w-full py-2 pl-3 pr-10 text-left bg-white border rounded-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                      <span className="block truncate">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${selectedStatus?.color}`}>
                          {selectedStatus?.label}
                        </span>
                      </span>
                    </Listbox.Button>
                    <Transition
                      as={Fragment}
                      leave="transition ease-in duration-100"
                      leaveFrom="opacity-100"
                      leaveTo="opacity-0"
                    >
                      <Listbox.Options className="absolute w-full py-1 mt-1 overflow-auto text-base bg-white rounded-md shadow-lg max-h-60 ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                        {STATUS_OPTIONS.map((status) => (
                          <Listbox.Option
                            key={status.id}
                            className={({ active }) =>
                              `${active ? 'bg-blue-50' : 'bg-white'}
                              cursor-pointer select-none relative py-2 pl-3 pr-9`
                            }
                            value={status}
                          >
                            {({ active }) => (
                              <span className={`block truncate ${
                                status.id === currentStatus ? 'font-semibold' : 'font-normal'
                              }`}>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${status.color}`}>
                                  {status.label}
                                </span>
                              </span>
                            )}
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </Transition>
                  </div>
                </Listbox>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={onClose}
                >
                  Cancel
                </button>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
