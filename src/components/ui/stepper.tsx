import { Box, Flex, Text } from '@chakra-ui/react';
import { Check } from 'lucide-react';

interface StepDef {
  id: string;
  label: string;
}

interface StepIndicatorProps {
  steps: StepDef[];
  currentStepIndex: number;
  className?: string;
}

function StepIndicator({ steps, currentStepIndex, className }: StepIndicatorProps) {
  return (
    <Box as="nav" aria-label="Progress" w="full" className={className}>
      <Flex as="ol" align="start">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const status =
            index < currentStepIndex ? 'complete' : index === currentStepIndex ? 'active' : 'upcoming';

          return (
            <Flex
              as="li"
              key={step.id}
              align="start"
              flex={isLast ? undefined : '1'}
              flexShrink={isLast ? 0 : undefined}
            >
              {/* Circle + label */}
              <Flex direction="column" align="center" flexShrink={0}>
                <Flex
                  as="span"
                  role="tab"
                  tabIndex={-1}
                  aria-current={status === 'active' ? 'step' : undefined}
                  h="7"
                  w="7"
                  align="center"
                  justify="center"
                  borderRadius="full"
                  fontSize="12px"
                  fontWeight="semibold"
                  transition="all 0.3s ease-out"
                  style={
                    status === 'active'
                      ? {
                          background: 'var(--accent)',
                          color: 'white',
                          boxShadow: '0 0 12px rgba(147,51,234,0.3), 0 2px 8px rgba(0,0,0,0.1)',
                          transform: 'scale(1.1)',
                        }
                      : status === 'complete'
                        ? {
                            background: 'var(--accent)',
                            color: 'white',
                            opacity: 0.7,
                          }
                        : {
                            background: 'var(--bg-input)',
                            color: 'var(--text-tertiary)',
                            border: '1px solid var(--border-glass)',
                          }
                  }
                >
                  {status === 'complete' ? (
                    <Check className="h-3.5 w-3.5" data-testid="step-check" />
                  ) : (
                    <Text as="span">{index + 1}</Text>
                  )}
                </Flex>

                <Text
                  as="span"
                  mt="1.5"
                  textAlign="center"
                  fontSize="11px"
                  lineHeight="tight"
                  transition="all 0.3s ease-out"
                  fontWeight={status === 'active' ? 'semibold' : 'normal'}
                  color={status === 'active' ? 'var(--accent-fg)' : 'var(--text-tertiary)'}
                >
                  {step.label}
                </Text>
              </Flex>

              {/* Connecting line */}
              {!isLast && (
                <Box
                  aria-hidden="true"
                  mt="13px"
                  mx="2"
                  flex="1"
                  h="1px"
                  transition="all 0.3s ease-out"
                  style={
                    status === 'complete'
                      ? { background: 'var(--accent)', opacity: 0.4 }
                      : { background: 'var(--border-glass)' }
                  }
                />
              )}
            </Flex>
          );
        })}
      </Flex>
    </Box>
  );
}

export { StepIndicator };
export type { StepIndicatorProps };
