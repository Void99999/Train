// Copyright LAST TRAIN. All rights reserved.

#include "Train/Locomotive.h"

#include "Components/BoxComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Data/LastTrainBalance.h"
#include "Engine/StaticMesh.h"
#include "LastTrain.h"
#include "Train/ThrottleControlComponent.h"
#include "Train/TrainDoorComponent.h"

ALocomotive::ALocomotive()
{
	VehicleId = TEXT("locomotive");

	LeftDoor = CreateDefaultSubobject<UTrainDoorComponent>(TEXT("LeftDoor"));
	LeftDoor->SetupAttachment(Hull);

	RightDoor = CreateDefaultSubobject<UTrainDoorComponent>(TEXT("RightDoor"));
	RightDoor->SetupAttachment(Hull);

	RearDoor = CreateDefaultSubobject<UTrainDoorComponent>(TEXT("RearDoor"));
	RearDoor->SetupAttachment(Hull);

	ThrottleControl = CreateDefaultSubobject<UThrottleControlComponent>(TEXT("ThrottleControl"));
	ThrottleControl->SetupAttachment(Hull);

	// The blockout cube stands in for the hull; the cab is built inside it, so
	// the outer shell must not also be a solid box or the player is sealed in.
	if (BlockoutMesh)
	{
		BlockoutMesh->SetVisibility(false);
	}
}

void ALocomotive::BeginPlay()
{
	Super::BeginPlay();
	BuildCabBlockout();
}

UStaticMeshComponent* ALocomotive::AddBlockoutBox(const FName Name, const FVector& Centre,
	const FVector& Size, bool bCollides)
{
	UStaticMesh* Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"));
	if (!Cube)
	{
		return nullptr;
	}

	UStaticMeshComponent* Piece = NewObject<UStaticMeshComponent>(this, Name);
	Piece->SetStaticMesh(Cube);
	Piece->SetupAttachment(Hull);
	Piece->RegisterComponent();
	Piece->SetMobility(EComponentMobility::Movable);

	// The engine cube is 100 units across, so a scale is a size in metres.
	Piece->SetRelativeLocation(Centre);
	Piece->SetRelativeScale3D(Size / 100.f);

	// Collision and the visible shape are created together, from the same
	// numbers, so they cannot drift apart - which is what produced walls you
	// could see through and walls you could walk through in the prototype.
	Piece->SetCollisionProfileName(bCollides ? TEXT("TrainVehicle") : TEXT("NoCollision"));

	BlockoutPieces.Add(Piece);
	return Piece;
}

void ALocomotive::BuildCabBlockout()
{
	/*
	 * PLACEHOLDER GEOMETRY.
	 *
	 * Everything below is boxes. It exists so the cab is a room the player can
	 * walk around in, with doors that work and walkways to step out onto,
	 * before any art exists. It is a blockout and it looks like one; it is not
	 * a finished interior and must not be presented as one.
	 *
	 * The layout carries over from the browser prototype, where it was tuned by
	 * walking it: a cab at the back of the hull, a windscreen and console at the
	 * front, a doorway in each side wall, and a railed deck outside each door.
	 */
	const float HullLengthCm = ULastTrainBalance::MetresToCm(Row.LengthMetres);
	const float HullWidthCm = ULastTrainBalance::MetresToCm(Row.WidthMetres);
	const float HullHeightCm = ULastTrainBalance::MetresToCm(Row.HeightMetres);

	if (HullLengthCm <= 0.f)
	{
		UE_LOG(LogLastTrainTrain, Warning, TEXT("Locomotive has no catalogue row yet; skipping the cab blockout."));
		return;
	}

	const float HalfWidth = HullWidthCm * 0.5f;
	const float InnerHalfWidth = HalfWidth - WallThicknessCm;

	// The cab sits at the rear of the hull. X runs along the rail, forward is +X.
	const float CabRearX = -HullLengthCm * 0.5f + 65.f;
	const float CabFrontX = CabRearX + CabLengthCm;
	const float CabCentreX = (CabRearX + CabFrontX) * 0.5f;

	// Heights are measured from the hull's centre, which is where the actor's
	// origin sits after PlaceOnRail lifts it clear of the rail.
	const float FloorZ = -HullHeightCm * 0.5f + 40.f;
	const float CeilingZ = FloorZ + 260.f;
	const float WallCentreZ = (FloorZ + CeilingZ) * 0.5f;
	const float WallHeight = CeilingZ - FloorZ;

	AddBlockoutBox(TEXT("CabFloor"),
		FVector(CabCentreX, 0.f, FloorZ - WallThicknessCm * 0.5f),
		FVector(CabLengthCm, InnerHalfWidth * 2.f, WallThicknessCm));

	AddBlockoutBox(TEXT("CabCeiling"),
		FVector(CabCentreX, 0.f, CeilingZ + WallThicknessCm * 0.5f),
		FVector(CabLengthCm, InnerHalfWidth * 2.f, WallThicknessCm));

	AddBlockoutBox(TEXT("CabRearWall"),
		FVector(CabRearX, 0.f, WallCentreZ),
		FVector(WallThicknessCm, InnerHalfWidth * 2.f, WallHeight));

	// The front wall is split around the windscreen so the driver can see out.
	AddBlockoutBox(TEXT("CabFrontSill"),
		FVector(CabFrontX, 0.f, FloorZ + 52.f),
		FVector(WallThicknessCm, InnerHalfWidth * 2.f, 104.f));
	AddBlockoutBox(TEXT("CabFrontHeader"),
		FVector(CabFrontX, 0.f, CeilingZ - 20.f),
		FVector(WallThicknessCm, InnerHalfWidth * 2.f, 40.f));

	// Side walls, each with a doorway cut through it. The doorway is a gap
	// between two panels rather than a hole in one, because a hole in a box is
	// not something box geometry can express.
	const float DoorCentreX = CabRearX + 105.f;
	const float DoorWidth = 92.f;
	const float DoorHeadZ = FloorZ + 206.f;

	for (int32 Side = -1; Side <= 1; Side += 2)
	{
		const float WallY = Side * InnerHalfWidth;
		const TCHAR* SideName = Side < 0 ? TEXT("Left") : TEXT("Right");

		const float RearPanelStart = CabRearX;
		const float RearPanelEnd = DoorCentreX - DoorWidth * 0.5f;
		const float FrontPanelStart = DoorCentreX + DoorWidth * 0.5f;

		AddBlockoutBox(FName(*FString::Printf(TEXT("CabWall%s_Rear"), SideName)),
			FVector((RearPanelStart + RearPanelEnd) * 0.5f, WallY, WallCentreZ),
			FVector(RearPanelEnd - RearPanelStart, WallThicknessCm, WallHeight));

		AddBlockoutBox(FName(*FString::Printf(TEXT("CabWall%s_Front"), SideName)),
			FVector((FrontPanelStart + CabFrontX) * 0.5f, WallY, WallCentreZ),
			FVector(CabFrontX - FrontPanelStart, WallThicknessCm, WallHeight));

		// Over the doorway, so nothing can be walked through up there.
		AddBlockoutBox(FName(*FString::Printf(TEXT("CabWall%s_Header"), SideName)),
			FVector(DoorCentreX, WallY, (DoorHeadZ + CeilingZ) * 0.5f),
			FVector(DoorWidth, WallThicknessCm, CeilingZ - DoorHeadZ));

		/*
		 * The walkway.
		 *
		 * Its deck is flush with the cab floor, so stepping out is a step
		 * across and not a drop. Wider than a real locomotive's running board:
		 * the player's collision capsule is 68 cm across, and on a realistic
		 * 60 cm deck he is wedged between the hull and the railing with
		 * nowhere to stand.
		 */
		const float DeckInner = HalfWidth;
		const float DeckOuter = HalfWidth + WalkwayWidthCm;
		const float DeckCentreY = Side * (DeckInner + DeckOuter) * 0.5f;
		const float DeckLength = HullLengthCm - 50.f;

		AddBlockoutBox(FName(*FString::Printf(TEXT("Walkway%s_Deck"), SideName)),
			FVector(0.f, DeckCentreY, FloorZ - 6.f),
			FVector(DeckLength, WalkwayWidthCm, 12.f));

		AddBlockoutBox(FName(*FString::Printf(TEXT("Walkway%s_Railing"), SideName)),
			FVector(0.f, Side * DeckOuter, FloorZ + RailingHeightCm * 0.5f),
			FVector(DeckLength, 8.f, RailingHeightCm));

		// Closed at both ends, so nobody walks off the front of the machine.
		for (const int32 End : { -1, 1 })
		{
			AddBlockoutBox(FName(*FString::Printf(TEXT("Walkway%s_End%d"), SideName, End)),
				FVector(End * DeckLength * 0.5f, DeckCentreY, FloorZ + RailingHeightCm * 0.5f),
				FVector(8.f, WalkwayWidthCm, RailingHeightCm));
		}
	}

	// The console the throttle sits on.
	const float ConsoleX = CabFrontX - 45.f;
	AddBlockoutBox(TEXT("Console"),
		FVector(ConsoleX, -15.f, FloorZ + 53.f),
		FVector(70.f, 230.f, 106.f));

	/* ------------------------------------------------------ fittings */

	if (ThrottleControl)
	{
		// On the driver's edge of the desk, where a hand falls on it.
		ThrottleControl->SetRelativeLocation(FVector(ConsoleX - 16.f, -42.f, FloorZ + 115.f));
	}

	if (LeftDoor)
	{
		LeftDoor->SetRelativeLocation(FVector(DoorCentreX, -InnerHalfWidth, FloorZ + 100.f));
		LeftDoor->SetRelativeRotation(FRotator(0.f, 0.f, 0.f));
	}
	if (RightDoor)
	{
		RightDoor->SetRelativeLocation(FVector(DoorCentreX, InnerHalfWidth, FloorZ + 100.f));
		RightDoor->SetRelativeRotation(FRotator(0.f, 180.f, 0.f));
	}
	if (RearDoor)
	{
		RearDoor->SetRelativeLocation(FVector(CabRearX, 0.f, FloorZ + 100.f));
		RearDoor->SetRelativeRotation(FRotator(0.f, 90.f, 0.f));
	}

	UE_LOG(LogLastTrainTrain, Log,
		TEXT("Locomotive cab blockout built from %d placeholder boxes. This is a blockout, not final art."),
		BlockoutPieces.Num());
}
