import {
  Toaster as ChakraToaster,
  createToaster,
  ToastActionTrigger,
  ToastCloseTrigger,
  ToastDescription,
  ToastRoot,
} from '@chakra-ui/react';

export const toaster = createToaster({
  placement: 'bottom',
});

export function Toaster() {
  return (
    <ChakraToaster toaster={toaster}>
      {(toast) => (
        <ToastRoot>
          {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
          {toast.action && (
            <ToastActionTrigger>{toast.action.label}</ToastActionTrigger>
          )}
          <ToastCloseTrigger />
        </ToastRoot>
      )}
    </ChakraToaster>
  );
}
