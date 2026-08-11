// Copyright LAST TRAIN. All rights reserved.

#include "Data/LastTrainDataRegistry.h"

#include "Data/LastTrainBalance.h"
#include "Engine/DataTable.h"
#include "Engine/GameInstance.h"
#include "LastTrain.h"

void ULastTrainDataRegistry::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);

	const ULastTrainBalance& Balance = ULastTrainBalance::Get();

	// Every table has to load for the asset path to be believed. A half-loaded
	// catalogue - rifles from an asset, wagons from the fallback - is worse
	// than either, because a balancing change would appear to do nothing.
	const bool bAllLoaded =
		LoadTable(Balance.WeaponTable, Weapons, TEXT("weapons")) &
		LoadTable(Balance.VehicleTable, Vehicles, TEXT("vehicles")) &
		LoadTable(Balance.CargoTable, Cargo, TEXT("cargo")) &
		LoadTable(Balance.EnemyTable, Enemies, TEXT("enemies")) &
		LoadTable(Balance.OutpostTable, Outposts, TEXT("outposts"));

	if (bAllLoaded)
	{
		bLoadedFromDataTables = true;
		UE_LOG(LogLastTrain, Log, TEXT("Data registry: loaded catalogues from DataTable assets."));
	}
	else
	{
		Weapons.Reset();
		Vehicles.Reset();
		Cargo.Reset();
		Enemies.Reset();
		Outposts.Reset();
		LoadedTables.Reset();

		ApplyDefaultCatalogue();
		bLoadedFromDataTables = false;
		UE_LOG(LogLastTrain, Log,
			TEXT("Data registry: using the compiled-in catalogue. Import the CSVs in ")
			TEXT("Content/LastTrain/Data/Source and assign them under Project Settings ")
			TEXT("-> Game -> Last Train Balance to tune these in the editor."));
	}

	RebuildDerivedViews();
}

void ULastTrainDataRegistry::Deinitialize()
{
	LoadedTables.Reset();
	Weapons.Reset();
	Vehicles.Reset();
	Cargo.Reset();
	Enemies.Reset();
	Outposts.Reset();
	OutpostsInOrder.Reset();

	Super::Deinitialize();
}

ULastTrainDataRegistry* ULastTrainDataRegistry::Get(const UObject* WorldContext)
{
	if (!WorldContext)
	{
		return nullptr;
	}
	const UWorld* World = WorldContext->GetWorld();
	if (!World)
	{
		return nullptr;
	}
	UGameInstance* GameInstance = World->GetGameInstance();
	return GameInstance ? GameInstance->GetSubsystem<ULastTrainDataRegistry>() : nullptr;
}

template <typename TRow>
bool ULastTrainDataRegistry::LoadTable(const FSoftObjectPath& Path, TMap<FName, TRow>& OutRows, const TCHAR* Label)
{
	if (!Path.IsValid())
	{
		return false;
	}

	UDataTable* Table = Cast<UDataTable>(Path.TryLoad());
	if (!Table)
	{
		UE_LOG(LogLastTrain, Warning, TEXT("Data registry: %s table at '%s' could not be loaded."),
			Label, *Path.ToString());
		return false;
	}

	if (Table->GetRowStruct() != TRow::StaticStruct())
	{
		UE_LOG(LogLastTrain, Warning,
			TEXT("Data registry: %s table '%s' uses row struct '%s', expected '%s'."),
			Label, *Path.ToString(),
			Table->GetRowStruct() ? *Table->GetRowStruct()->GetName() : TEXT("none"),
			*TRow::StaticStruct()->GetName());
		return false;
	}

	const TArray<FName> RowNames = Table->GetRowNames();
	if (RowNames.Num() == 0)
	{
		UE_LOG(LogLastTrain, Warning, TEXT("Data registry: %s table '%s' is empty."), Label, *Path.ToString());
		return false;
	}

	OutRows.Reserve(RowNames.Num());
	for (const FName& RowName : RowNames)
	{
		if (const TRow* Row = Table->FindRow<TRow>(RowName, TEXT("LastTrainDataRegistry"), /*bWarnIfMissing*/ false))
		{
			OutRows.Add(RowName, *Row);
		}
	}

	LoadedTables.Add(Table);
	return OutRows.Num() > 0;
}

void ULastTrainDataRegistry::RebuildDerivedViews()
{
	OutpostsInOrder.Reset();
	Outposts.GenerateValueArray(OutpostsInOrder);
	OutpostsInOrder.Sort([](const FOutpostRow& A, const FOutpostRow& B)
	{
		return A.DistanceKm < B.DistanceKm;
	});
}

const FWeaponRow* ULastTrainDataRegistry::FindWeapon(FName WeaponId) const
{
	return Weapons.Find(WeaponId);
}

const FVehicleRow* ULastTrainDataRegistry::FindVehicle(FName VehicleId) const
{
	return Vehicles.Find(VehicleId);
}

const FCargoRow* ULastTrainDataRegistry::FindCargo(FName CargoId) const
{
	return Cargo.Find(CargoId);
}

const FEnemyRow* ULastTrainDataRegistry::FindEnemy(FName EnemyId) const
{
	return Enemies.Find(EnemyId);
}

const FOutpostRow* ULastTrainDataRegistry::FindOutpost(FName OutpostId) const
{
	return Outposts.Find(OutpostId);
}

FName ULastTrainDataRegistry::MakeVehicleId(EVehicleKind Kind, int32 Level)
{
	const TCHAR* Prefix = TEXT("transport");
	switch (Kind)
	{
	case EVehicleKind::Locomotive:	Prefix = TEXT("locomotive"); break;
	case EVehicleKind::Combat:		Prefix = TEXT("combat"); break;
	case EVehicleKind::Transport:
	default:						Prefix = TEXT("transport"); break;
	}

	// The locomotive has no levels, so it is a bare id rather than one_1.
	if (Kind == EVehicleKind::Locomotive)
	{
		return FName(Prefix);
	}
	return FName(*FString::Printf(TEXT("%s_%d"), Prefix, FMath::Max(1, Level)));
}

TArray<FName> ULastTrainDataRegistry::GetPersonalWeaponIds() const
{
	TArray<FName> Ids;
	for (const TPair<FName, FWeaponRow>& Pair : Weapons)
	{
		if (Pair.Value.bPersonal)
		{
			Ids.Add(Pair.Key);
		}
	}

	// A stable order, so the wheel does not reshuffle itself between sessions.
	Ids.Sort([this](const FName& A, const FName& B)
	{
		const FWeaponRow* RowA = Weapons.Find(A);
		const FWeaponRow* RowB = Weapons.Find(B);
		if (RowA && RowB && RowA->Price != RowB->Price)
		{
			return RowA->Price < RowB->Price;
		}
		return A.LexicalLess(B);
	});
	return Ids;
}
