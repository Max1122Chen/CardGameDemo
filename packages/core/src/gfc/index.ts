export { GameplayNotImplementedError, GameplayEffectError } from './errors.js';
export { GfcComponentType } from './gfc-component-type.js';
export {
  GameplayFrameworkComponent,
  type GameplayFrameworkComponentOptions,
} from './gameplay-framework-component.js';
export type {
  ActiveGameplayEffect,
  ActiveGameplayEffectSnapshot,
  ActiveAbilitySnapshot,
  AttributeChangeCallback,
  AttributeChangeContext,
  AttributeEvaluationPipeline,
  AttributeValue,
  GameplayEffectApplicationContext,
  GameplayEffectDefinition,
  GameplayEffectDuration,
  GameplayEffectModifier,
  GameplayEffectStacking,
  GameplayModifierMagnitude,
  GameplayModifierOp,
  GrantedAbilitySnapshot,
  GfcAttributeSnapshot,
  GfcSnapshot,
  GfcTagSnapshot,
  OngoingTagRequirements,
  SetByCallerMap,
} from './types.js';
export {
  assignModifierStages,
  evaluateFlatAttributeValue,
  evaluateStagedAttributeValue,
  modifierRequiresEntity,
  normalizeModifierMagnitude,
  resolveModifierMagnitude,
} from './attribute-evaluation.js';
export {
  evaluateOngoingTagRequirements,
  resolveOngoingEntityId,
} from './ongoing-tag-requirements.js';
export {
  GameplayAbilityRuntime,
  GameplayAbilityError,
  AbilityActivationRegistry,
  evaluateTagGates,
  gatesNeedEntity,
  type AbilityActivationContext,
  type AbilityActivationHandler,
  type AbilityHandlerContext,
  type AbilityHandlerResult,
  type AbilityHookServices,
  type ActivationFailureReason,
  type ActivationResult,
  type ActiveAbilityEventInfo,
  type GameplayAbilityCost,
  type GameplayAbilityDefinition,
  type GameplayAbilityEffectBinding,
  type GameplayAbilityEffectTarget,
  type GameplayAbilityEndPolicy,
  type GameplayAbilityEventListen,
  type GameplayAbilityKind,
  type GameplayAbilityPassiveTrigger,
  type GameplayAbilityTagGates,
  type GameplayAbilityHost,
  type TakeDamageActivationData,
} from '../ga/index.js';
export {
  DefinitionParseError,
  parseGameplayAbilityDefinition,
  parseGameplayEffectDefinition,
  type WireGameplayAbilityDefinition,
  type WireGameplayAbilityEffectBindingSpec,
  type WireGameplayEffectDefinition,
} from '../definitions/parse-definitions.js';

