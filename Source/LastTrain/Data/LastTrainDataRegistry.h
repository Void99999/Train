// Copyright LAST TRAIN. All rights reserved.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Data/LastTrainCatalogRows.h"
#include "LastTrainDataRegistry.generated.h"

class UDataTable;

/**
 * One place to ask what anything in the game is.
 *
 * Systems never hold catalogue data of their own. They ask the registry for a
 * row by id and read it. That is what stops a weapon's damage existing in three
 * places and drifting.
 *
 * The registry loads DataTables named in the balance settings. If none are
 * assigned - which is the state of a freshly built project, before anything has
 * been imported in the editor - it falls back to a compiled-in default set that
 * carries the same numbers. The game is therefore playable from the first
 * successful compile, and becomes editor-tunable the moment the CSVs in
 * Content/LastTrain/Data/Source are imported and assigned.
 */
UCLASS()
class LASTTRAIN_API ULastTrainDataRegistry : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	/** Convenience: the registry for a world, or null outside of play. */
	static ULastTrainDataRegistry* Get(const UObject* WorldContext);

	/* --------------------------------------------------------- lookups */

	/** Null if the id is unknown. Callers must handle that rather than assume. */
	const FWeaponRow* FindWeapon(FName WeaponId) const;
	const FVehicleRow* FindVehicle(FName VehicleId) const;
	const FCargoRow* FindCargo(FName CargoId) const;
	const FEnemyRow* FindEnemy(FName EnemyId) const;
	const FOutpostRow* FindOutpost(FName OutpostId) const;

	/** The row name for a vehicle kind at a level, e.g. transport_3. */
	static FName MakeVehicleId(EVehicleKind Kind, int32 Level);

	const TMap<FName, FWeaponRow>& GetWeapons() const { return Weapons; }
	const TMap<FName, FVehicleRow>& GetVehicles() const { return Vehicles; }
	const TMap<FName, FCargoRow>& GetCargo() const { return Cargo; }
	const TMap<FName, FEnemyRow>& GetEnemies() const { return Enemies; }

	/** Outposts in the order they are reached. */
	const TArray<FOutpostRow>& GetOutpostsInOrder() const { return OutpostsInOrder; }

	/** Weapons that appear on the player's wheel, in catalogue order. */
	TArray<FName> GetPersonalWeaponIds() const;

	/** True when the catalogues came from assets rather than from the fallback. */
	bool IsUsingDataTables() const { return bLoadedFromDataTables; }

private:
	/** Reads a table into a map, keyed by row name. Returns false if it is unset or empty. */
	template <typename TRow>
	bool LoadTable(const FSoftObjectPath& Path, TMap<FName, TRow>& OutRows, const TCHAR* Label);

	/** The compiled-in catalogue. Defined in LastTrainDefaultData.cpp. */
	void ApplyDefaultCatalogue();

	void RebuildDerivedViews();

	UPROPERTY(Transient)
	TArray<TObjectPtr<UDataTable>> LoadedTables;

	TMap<FName, FWeaponRow> Weapons;
	TMap<FName, FVehicleRow> Vehicles;
	TMap<FName, FCargoRow> Cargo;
	TMap<FName, FEnemyRow> Enemies;
	TMap<FName, FOutpostRow> Outposts;

	TArray<FOutpostRow> OutpostsInOrder;

	bool bLoadedFromDataTables = false;
};
