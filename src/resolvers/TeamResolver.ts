import { Arg, FieldResolver, Query, Resolver, Root } from "type-graphql";
import { projects, tasks, ProjectData } from "../data";
import Team from "../schemas/Team";

@Resolver((of) => Team)
export default class {
  @Query((returns) => Team, { nullable: true })
  teamByName(@Arg("name") name: string): ProjectData | undefined {
    return projects.find((project) => project.name === name);
  }

  @FieldResolver()
  tasks(@Root() projectData: ProjectData) {
    return tasks.filter((task) => {
      return task.project_id === projectData.id;
    });
  }
}
