// Copyright LAST TRAIN. All rights reserved.

#include "Player/LastTrainInputConfig.h"

#include "EnhancedActionKeyMapping.h"
#include "InputAction.h"
#include "InputMappingContext.h"
#include "InputModifiers.h"
#include "LastTrain.h"

namespace
{
	UInputAction* MakeAction(UObject* Outer, const TCHAR* Name, EInputActionValueType ValueType)
	{
		UInputAction* Action = NewObject<UInputAction>(Outer, FName(Name));
		Action->ValueType = ValueType;
		return Action;
	}

	/**
	 * Maps a key and applies modifiers, which is how a set of digital keys
	 * becomes a 2D movement vector.
	 *
	 * Enhanced Input's convention: a key contributes to X by default. Negate
	 * flips it, and SwizzleAxis moves it onto Y. So W is "Y, positive" = swizzle
	 * to YXZ; S is the same plus negate; D is bare X; A is X negated.
	 */
	void MapWithModifiers(UInputMappingContext& Context, UInputAction* Action, const FKey& Key,
		bool bNegate, bool bSwizzleToY)
	{
		FEnhancedActionKeyMapping& Mapping = Context.MapKey(Action, Key);

		if (bSwizzleToY)
		{
			UInputModifierSwizzleAxis* Swizzle = NewObject<UInputModifierSwizzleAxis>(Action);
			Swizzle->Order = EInputAxisSwizzle::YXZ;
			Mapping.Modifiers.Add(Swizzle);
		}
		if (bNegate)
		{
			Mapping.Modifiers.Add(NewObject<UInputModifierNegate>(Action));
		}
	}
}

bool ULastTrainInputConfig::IsComplete() const
{
	return Move && Look && Jump && Sprint && Crouch && Interact
		&& Fire && Reload && WeaponWheel && Pause && MappingContext;
}

void ULastTrainInputConfig::BuildRuntimeFallback(UObject* Outer)
{
	if (IsComplete())
	{
		return;
	}

	if (!Outer)
	{
		Outer = this;
	}

	if (!Move)		{ Move = MakeAction(Outer, TEXT("IA_Move"), EInputActionValueType::Axis2D); }
	if (!Look)		{ Look = MakeAction(Outer, TEXT("IA_Look"), EInputActionValueType::Axis2D); }
	if (!Jump)		{ Jump = MakeAction(Outer, TEXT("IA_Jump"), EInputActionValueType::Boolean); }
	if (!Sprint)	{ Sprint = MakeAction(Outer, TEXT("IA_Sprint"), EInputActionValueType::Boolean); }
	if (!Crouch)	{ Crouch = MakeAction(Outer, TEXT("IA_Crouch"), EInputActionValueType::Boolean); }
	if (!Interact)	{ Interact = MakeAction(Outer, TEXT("IA_Interact"), EInputActionValueType::Boolean); }
	if (!Fire)		{ Fire = MakeAction(Outer, TEXT("IA_Fire"), EInputActionValueType::Boolean); }
	if (!Reload)	{ Reload = MakeAction(Outer, TEXT("IA_Reload"), EInputActionValueType::Boolean); }
	if (!WeaponWheel) { WeaponWheel = MakeAction(Outer, TEXT("IA_WeaponWheel"), EInputActionValueType::Boolean); }
	if (!Pause)		{ Pause = MakeAction(Outer, TEXT("IA_Pause"), EInputActionValueType::Boolean); }

	if (!MappingContext)
	{
		MappingContext = NewObject<UInputMappingContext>(Outer, TEXT("IMC_LastTrainDefault"));

		// The PC layout from the specification.
		MapWithModifiers(*MappingContext, Move, EKeys::W, /*bNegate*/ false, /*bSwizzleToY*/ true);
		MapWithModifiers(*MappingContext, Move, EKeys::S, /*bNegate*/ true, /*bSwizzleToY*/ true);
		MapWithModifiers(*MappingContext, Move, EKeys::D, /*bNegate*/ false, /*bSwizzleToY*/ false);
		MapWithModifiers(*MappingContext, Move, EKeys::A, /*bNegate*/ true, /*bSwizzleToY*/ false);

		// Mouse2D already delivers an XY delta, so it needs no modifiers. The
		// character applies its own inversion for pitch.
		MappingContext->MapKey(Look, EKeys::Mouse2D);

		MappingContext->MapKey(Jump, EKeys::SpaceBar);
		MappingContext->MapKey(Sprint, EKeys::LeftShift);
		MappingContext->MapKey(Crouch, EKeys::LeftControl);
		MappingContext->MapKey(Interact, EKeys::E);
		MappingContext->MapKey(Fire, EKeys::LeftMouseButton);
		MappingContext->MapKey(Reload, EKeys::R);
		MappingContext->MapKey(WeaponWheel, EKeys::Tab);
		MappingContext->MapKey(Pause, EKeys::Escape);
	}

	UE_LOG(LogLastTrainPlayer, Log,
		TEXT("Input: using the runtime fallback bindings. Author an Input Config asset ")
		TEXT("(see Docs/UNREAL_SETUP.md) to make these rebindable in the editor."));
}
