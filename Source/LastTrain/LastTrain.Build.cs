// Copyright LAST TRAIN. All rights reserved.

using UnrealBuildTool;

/**
 * The game module.
 *
 * One runtime module for now. It is split into folders that mirror the design
 * - Data, Core, Player, Train, Economy, World, AI, Audio, UI, Cinematics - and
 * the include paths below let those folders refer to each other by short paths
 * rather than by long relative ones.
 *
 * If the project grows a second module later (a good candidate is an editor-only
 * module for the blockout tooling), it goes beside this one rather than inside it.
 */
public class LastTrain : ModuleRules
{
	public LastTrain(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicIncludePaths.AddRange(new string[]
		{
			ModuleDirectory
		});

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"EnhancedInput",
			"UMG",
			"Niagara",
			"AIModule",
			"GameplayTasks",
			"NavigationSystem",
			// Balancing lives in Project Settings rather than in scattered
			// literals, which is what UDeveloperSettings is for.
			"DeveloperSettings"
		});

		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"Slate",
			"SlateCore",
			"MovieScene",
			"MovieSceneTracks",
			"LevelSequence"
		});
	}
}
