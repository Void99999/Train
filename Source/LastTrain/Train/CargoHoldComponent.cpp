// Copyright LAST TRAIN. All rights reserved.

#include "Train/CargoHoldComponent.h"

#include "Data/LastTrainDataRegistry.h"

UCargoHoldComponent::UCargoHoldComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void UCargoHoldComponent::ConfigureFromRow(int32 InTotalSlots)
{
	TotalSlots = FMath::Max(0, InTotalSlots);
	Contents.Reset();
	OnCargoChanged.Broadcast(0, TotalSlots);
}

int32 UCargoHoldComponent::SlotCostOf(FName CargoId) const
{
	const ULastTrainDataRegistry* Registry = ULastTrainDataRegistry::Get(this);
	const FCargoRow* Row = Registry ? Registry->FindCargo(CargoId) : nullptr;
	return Row ? FMath::Max(1, Row->SlotCost) : 1;
}

int32 UCargoHoldComponent::GetUsedSlots() const
{
	int32 Used = 0;
	for (const FCargoStack& Stack : Contents)
	{
		Used += Stack.Quantity * SlotCostOf(Stack.CargoId);
	}
	return Used;
}

int32 UCargoHoldComponent::GetQuantity(FName CargoId) const
{
	for (const FCargoStack& Stack : Contents)
	{
		if (Stack.CargoId == CargoId)
		{
			return Stack.Quantity;
		}
	}
	return 0;
}

int32 UCargoHoldComponent::GetSpaceFor(FName CargoId) const
{
	const int32 Cost = SlotCostOf(CargoId);
	return Cost > 0 ? GetFreeSlots() / Cost : 0;
}

int32 UCargoHoldComponent::Add(FName CargoId, int32 Quantity)
{
	if (CargoId.IsNone() || Quantity <= 0)
	{
		return 0;
	}

	// Partial loads are deliberate. A trader filling up should get as much as
	// fits rather than being told the whole purchase failed.
	const int32 Loadable = FMath::Min(Quantity, GetSpaceFor(CargoId));
	if (Loadable <= 0)
	{
		return 0;
	}

	for (FCargoStack& Stack : Contents)
	{
		if (Stack.CargoId == CargoId)
		{
			Stack.Quantity += Loadable;
			OnCargoChanged.Broadcast(GetUsedSlots(), TotalSlots);
			return Loadable;
		}
	}

	Contents.Emplace(CargoId, Loadable);
	OnCargoChanged.Broadcast(GetUsedSlots(), TotalSlots);
	return Loadable;
}

int32 UCargoHoldComponent::Remove(FName CargoId, int32 Quantity)
{
	if (CargoId.IsNone() || Quantity <= 0)
	{
		return 0;
	}

	for (int32 Index = 0; Index < Contents.Num(); ++Index)
	{
		FCargoStack& Stack = Contents[Index];
		if (Stack.CargoId != CargoId)
		{
			continue;
		}

		const int32 Taken = FMath::Min(Quantity, Stack.Quantity);
		Stack.Quantity -= Taken;
		if (Stack.Quantity <= 0)
		{
			Contents.RemoveAt(Index);
		}

		OnCargoChanged.Broadcast(GetUsedSlots(), TotalSlots);
		return Taken;
	}
	return 0;
}

void UCargoHoldComponent::RemoveFraction(float Fraction)
{
	if (Fraction <= 0.f)
	{
		return;
	}
	if (Fraction >= 1.f)
	{
		Contents.Reset();
		OnCargoChanged.Broadcast(0, TotalSlots);
		return;
	}

	for (int32 Index = Contents.Num() - 1; Index >= 0; --Index)
	{
		FCargoStack& Stack = Contents[Index];
		// Rounded up: losing a quarter of three barrels should cost one, not
		// nothing. Death is supposed to hurt.
		const int32 Lost = FMath::CeilToInt(Stack.Quantity * Fraction);
		Stack.Quantity = FMath::Max(0, Stack.Quantity - Lost);
		if (Stack.Quantity <= 0)
		{
			Contents.RemoveAt(Index);
		}
	}
	OnCargoChanged.Broadcast(GetUsedSlots(), TotalSlots);
}
